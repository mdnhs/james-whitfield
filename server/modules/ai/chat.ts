// server/modules/ai/chat.ts
import "server-only"

import { randomUUID } from "node:crypto"

import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
} from "ai"
import { format } from "date-fns"

import {
  HISTORY_LIMIT,
  labelOnlyChunk,
  persistableParts,
  trimHistory,
  type AiUIMessage,
} from "@/lib/ai/messages"
import type { ChatInput } from "@/lib/ai/schema"
import { hasPermission } from "@/lib/auth/permissions"
import { parseGlobal } from "@/lib/content/globals"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { audit } from "@/server/lib/audit"
import { findSetting } from "@/server/modules/content/repo"
import { DUBLIN } from "@/server/modules/dashboard/week"

import { contextSubject } from "./context"
import {
  appendMessage,
  createConversation,
  dropLastReply,
  historyFor,
  ownConversation,
  ownUserMessage,
  replaceFrom,
  titleFrom,
} from "./conversations"
import { errorTag, friendlyChatError, ToolFailure } from "./errors"
import { buildSystemPrompt, firstNameOf } from "./prompt"
import { getModel } from "./provider"
import {
  decryptApiKey,
  readAiSettings,
  roleAllowed,
  type AiStored,
} from "./settings"
import { buildTools } from "./tools"

export const MAX_STEPS = 5

type Turn = { tokensIn: number; tokensOut: number; tools: Set<string> }

function assertCanChat(s: AiStored, actor: Actor) {
  if (!s.enabled)
    throw new ApiError("FORBIDDEN", "The AI assistant is turned off")
  if (!roleAllowed(s, actor.roles))
    throw new ApiError(
      "FORBIDDEN",
      "The AI assistant isn't available for your role"
    )
}

// Ruling R10: provider, model, counts and tool names; never text or titles.
const summary = (
  s: AiStored,
  t: Turn,
  stopped: boolean,
  mode: "regenerated" | "edited" | null
) =>
  `Asked the AI assistant (${s.provider} · ${s.model} · ${t.tokensIn} in / ${t.tokensOut} out tokens${t.tools.size ? ` · tools: ${[...t.tools].join(", ")}` : ""}${mode ? ` · ${mode}` : ""}${stopped ? " · stopped" : ""})`

function streamError(error: unknown, s: AiStored) {
  if (error instanceof ToolFailure) return error.message
  console.error("[ai] chat failed", errorTag(error))
  return friendlyChatError(error, s.provider)
}

// The new message is written before streaming, so a failure there reaches the
// global error handler, which logs the whole error. A database error carries
// the query parameters (the message text, the title), so it is logged as a
// tag here and the person gets the generic message (Review Focus 2).
async function saving<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (error) {
    console.error("[ai] could not save your message", errorTag(error))
    throw new ApiError("INTERNAL", "Couldn't save your message. Try again.")
  }
}

// Which conversation, and what was written before streaming. A plain
// message is appended. Regenerate drops the last reply, if any, and runs the
// turn again from the person's last message. Edit replaces one of their own
// messages and everything after it. Ownership of the conversation, and of the
// message within it, is part of every lookup, so another person's ids are
// simply not found (Review Focus 4).
async function prepareTurn(actor: Actor, input: ChatInput, model: string) {
  if (input.regenerate) {
    const conversation = await ownConversation(
      actor.userId,
      input.conversationId!
    )
    await saving(() => dropLastReply(conversation.id))
    return { conversation, mode: "regenerated" as const }
  }
  const userMessage: AiUIMessage = {
    id: randomUUID(),
    role: "user",
    parts: [{ type: "text", text: input.text! }],
  }
  if (input.editMessageId) {
    const conversation = await ownConversation(
      actor.userId,
      input.conversationId!
    )
    const from = await ownUserMessage(conversation.id, input.editMessageId)
    await saving(() => replaceFrom(conversation.id, from, userMessage))
    return { conversation, mode: "edited" as const }
  }
  const conversation = input.conversationId
    ? await ownConversation(actor.userId, input.conversationId)
    : await saving(() =>
        createConversation(actor.userId, titleFrom(input.text!), model)
      )
  await saving(() => appendMessage(conversation.id, userMessage))
  return { conversation, mode: null }
}

export async function startChat(
  actor: Actor,
  input: ChatInput,
  signal?: AbortSignal
): Promise<Response> {
  const { value: settings } = await readAiSettings()
  assertCanChat(settings, actor)
  const model = await getModel({ ...settings, apiKey: decryptApiKey(settings) })
  const { conversation, mode } = await prepareTurn(actor, input, settings.model)

  // Ruling R8: every turn comes from our rows, the new one saved first.
  // Ruling R14: enquiry details need the opt-in and lead.read. Replies
  // written under it are flagged, and stay out of the history once it's off.
  const sharing =
    settings.shareEnquiryDetails.enabled &&
    hasPermission(actor.roles, { lead: ["read"] })
  const history = await historyFor(conversation.id, HISTORY_LIMIT, {
    includeShared: sharing,
  })
  const userMessage = history.at(-1)
  if (userMessage?.role !== "user")
    throw new ApiError("CONFLICT", "There's no message to answer yet")

  const tools = buildTools({ actor, settings })
  const site = parseGlobal("site", (await findSetting("site"))?.value)
  const turn: Turn = { tokensIn: 0, tokensOut: 0, tools: new Set() }
  const result = streamText({
    model,
    instructions: buildSystemPrompt({
      siteName: site.name,
      firstName: firstNameOf(actor.name),
      roles: actor.roles,
      today: format(new Date(), "EEEE d MMMM yyyy", { in: DUBLIN }),
      toolNames: Object.keys(tools),
      extra: settings.systemPrompt,
      context: await contextSubject(actor, input.context),
    }),
    messages: await convertToModelMessages(trimHistory(history)),
    tools,
    stopWhen: isStepCount(MAX_STEPS),
    maxOutputTokens: settings.maxOutputTokens,
    maxRetries: 1,
    timeout: { totalMs: 120_000, chunkMs: 30_000 },
    // Stop in the sheet aborts the fetch, which aborts the provider call.
    abortSignal: signal,
    // The default logs the whole error, provider body (and so any echoed key)
    // included. streamError below logs a tag instead.
    onError: () => {},
    onStepEnd: (step) => {
      turn.tokensIn += step.usage.inputTokens ?? 0
      turn.tokensOut += step.usage.outputTokens ?? 0
      for (const call of step.toolCalls) turn.tools.add(call.toolName)
    },
  })
  // Keeps the pipeline draining so onEnd (save + audit) always runs.
  void result.consumeStream({ onError: () => {} })

  const ui = toUIMessageStream<typeof tools, AiUIMessage>({
    stream: result.stream,
    tools,
    sendReasoning: false,
    generateMessageId: randomUUID,
    messageMetadata: ({ part }) =>
      part.type === "start"
        ? { conversationId: conversation.id, userMessageId: userMessage.id }
        : undefined,
    onError: (error) => streamError(error, settings),
    // A stopped answer keeps what was streamed: its text and the labels of
    // finished lookups. Half-done tool calls are dropped, so the saved row
    // is always a complete message (Review Focus 5).
    onEnd: async ({ responseMessage, isAborted, isCancelled }) => {
      try {
        const parts = persistableParts(responseMessage.parts)
        if (parts.length)
          await appendMessage(
            conversation.id,
            { ...responseMessage, parts },
            {
              tokensIn: turn.tokensIn,
              tokensOut: turn.tokensOut,
              sharedEnquiryDetails: sharing,
            }
          )
        await audit(actor, {
          action: "ai.chat",
          entityType: "ai_conversation",
          entityId: conversation.id,
          summary: summary(
            settings,
            turn,
            isAborted || isCancelled === true || signal?.aborted === true,
            mode
          ),
        })
      } catch (error) {
        console.error("[ai] could not save the reply", errorTag(error))
      }
    },
  })

  return createUIMessageStreamResponse({
    // no-transform: Next's gzip (`compress`) and proxies leave SSE unbuffered.
    headers: { "cache-control": "no-cache, no-transform" },
    stream: ui.pipeThrough(
      new TransformStream({
        transform: (chunk, controller) =>
          controller.enqueue(labelOnlyChunk(chunk)),
      })
    ),
  })
}

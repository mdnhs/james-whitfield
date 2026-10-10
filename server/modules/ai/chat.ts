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
  persistableParts,
  trimHistory,
  type AiUIMessage,
} from "@/lib/ai/messages"
import type { ChatInput } from "@/lib/ai/schema"
import { parseGlobal } from "@/lib/content/globals"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { audit } from "@/server/lib/audit"
import { findSetting } from "@/server/modules/content/repo"
import { DUBLIN } from "@/server/modules/dashboard/week"

import {
  appendMessage,
  createConversation,
  historyFor,
  ownConversation,
  titleFrom,
} from "./conversations"
import { errorTag, friendlyChatError, ToolFailure } from "./errors"
import { buildSystemPrompt } from "./prompt"
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
const summary = (s: AiStored, t: Turn, stopped: boolean) =>
  `Asked the AI assistant (${s.provider} · ${s.model} · ${t.tokensIn} in / ${t.tokensOut} out tokens${t.tools.size ? ` · tools: ${[...t.tools].join(", ")}` : ""}${stopped ? " · stopped" : ""})`

function streamError(error: unknown, s: AiStored) {
  if (error instanceof ToolFailure) return error.message
  console.error("[ai] chat failed", errorTag(error))
  return friendlyChatError(error, s.provider)
}

export async function startChat(
  actor: Actor,
  input: ChatInput,
  signal?: AbortSignal
): Promise<Response> {
  const { value: settings } = await readAiSettings()
  assertCanChat(settings, actor)
  const model = await getModel({ ...settings, apiKey: decryptApiKey(settings) })
  const conversation = input.conversationId
    ? await ownConversation(actor.userId, input.conversationId)
    : await createConversation(
        actor.userId,
        titleFrom(input.text),
        settings.model
      )

  // Ruling R8: earlier turns from our rows; the new one saved before streaming.
  const history = await historyFor(conversation.id, HISTORY_LIMIT - 1)
  const userMessage: AiUIMessage = {
    id: randomUUID(),
    role: "user",
    parts: [{ type: "text", text: input.text }],
  }
  await appendMessage(conversation.id, userMessage)

  const tools = buildTools({ actor, settings })
  const site = parseGlobal("site", (await findSetting("site"))?.value)
  const turn: Turn = { tokensIn: 0, tokensOut: 0, tools: new Set() }
  const result = streamText({
    model,
    instructions: buildSystemPrompt({
      siteName: site.name,
      userName: actor.name,
      roles: actor.roles,
      today: format(new Date(), "EEEE d MMMM yyyy", { in: DUBLIN }),
      toolNames: Object.keys(tools),
      extra: settings.systemPrompt,
    }),
    messages: await convertToModelMessages(
      trimHistory([...history, userMessage])
    ),
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

  return createUIMessageStreamResponse({
    // no-transform: Next's gzip (`compress`) and proxies leave SSE unbuffered.
    headers: { "cache-control": "no-cache, no-transform" },
    stream: toUIMessageStream<typeof tools, AiUIMessage>({
      stream: result.stream,
      tools,
      sendReasoning: false,
      generateMessageId: randomUUID,
      messageMetadata: ({ part }) =>
        part.type === "start" ? { conversationId: conversation.id } : undefined,
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
              { tokensIn: turn.tokensIn, tokensOut: turn.tokensOut }
            )
          await audit(actor, {
            action: "ai.chat",
            entityType: "ai_conversation",
            entityId: conversation.id,
            summary: summary(
              settings,
              turn,
              isAborted || isCancelled === true || signal?.aborted === true
            ),
          })
        } catch (error) {
          console.error("[ai] could not save the reply", errorTag(error))
        }
      },
    }),
  })
}

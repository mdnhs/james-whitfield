import "server-only"

import { generateText, isStepCount, tool } from "ai"
import { format } from "date-fns"
import { z } from "zod"

import { ChatGlobal } from "@/lib/content/globals"
import { hitLimit } from "@/server/lib/rate-limit-db"
import { errorTag } from "@/server/modules/ai/errors"
import { getModel, mockEnabled } from "@/server/modules/ai/provider"
import {
  decryptApiKey,
  isConfigured,
  readAiSettings,
} from "@/server/modules/ai/settings"
import { DUBLIN } from "@/server/modules/dashboard/week"
import { getGlobal } from "@/server/modules/globals/service"

import { loadKnowledge } from "./knowledge"
import { isCrisis } from "./crisis"
import { notifyNeedsHuman, type AlertReason } from "./notify"
import { buildBotPrompt, toModelMessages } from "./prompt"
import * as repo from "./repo"

export type BotOutcome = "replied" | "skipped" | "handoff" | "failed"

const MAX_ROUNDS = 3
const SITE_REPLIES = { limit: 300, windowMs: 3_600_000 }

const NOTICES: Record<AlertReason, string> = {
  handoff:
    "I've asked Magda's team to join. They'll reply here, or by email if you leave one.",
  limit:
    "I've passed this chat to Magda's team so a person can help from here.",
  failed:
    "The assistant is unavailable right now. Magda's team has been notified and will reply soon.",
  crisis:
    "If you are in danger or thinking about harming yourself, please call 112 or 999 now, or Samaritans free on 116 123 (24 hours). This chat is not an emergency service.",
}

type Hist = { sender: "visitor" | "staff" | "ai"; body: string }[]

async function readChat() {
  const { value } = await getGlobal("chat")
  const d = ChatGlobal.parse({})
  return {
    enabled: value.enabled,
    botEnabled: value.bot.enabled,
    botName: value.bot.name || d.bot.name,
    extra: value.bot.extraInstructions,
    maxAiReplies: value.bot.maxAiReplies,
  }
}

export async function isActive(): Promise<boolean> {
  const chat = await readChat()
  if (!chat.enabled || !chat.botEnabled) return false
  if (mockEnabled()) return true
  return isConfigured((await readAiSettings()).value)
}

const botOwns = (c: repo.ChatRow) =>
  c.status === "open" && c.aiEnabled && !c.needsHuman && !c.assignedTo

async function handOff(id: string, reason: AlertReason): Promise<"handoff"> {
  await repo.addMessage({
    conversationId: id,
    sender: "system",
    body: NOTICES[reason],
    noticeKind: reason,
  })
  await repo.flagNeedsHuman(id)
  await notifyNeedsHuman(id, reason)
  return "handoff"
}

export async function maybeReply(id: string): Promise<BotOutcome> {
  if (!(await isActive())) return "skipped"
  if (!(await repo.claimLease(id))) return "skipped"
  try {
    return await run(id)
  } finally {
    await repo.releaseLease(id)
  }
}

async function run(id: string): Promise<BotOutcome> {
  let history: Hist | null = null
  let replied = false

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const chat = await repo.byId(id)
    if (!chat || !botOwns(chat)) return replied ? "replied" : "skipped"

    const seen: Hist = history ?? (await repo.recentForModel(id, 20))
    const last = seen.at(-1)
    if (!last || last.sender !== "visitor")
      return replied ? "replied" : "skipped"

    if (isCrisis(last.body)) return handOff(id, "crisis")

    const settings = await readChat()
    if (chat.aiReplyCount >= settings.maxAiReplies) return handOff(id, "limit")
    const site = await hitLimit("chat-bot:global", SITE_REPLIES)
    if (!site.allowed) return handOff(id, "limit")

    let handoffCalled = false
    let text = ""
    try {
      const { value: ai } = await readAiSettings()
      const model = await getModel({ ...ai, apiKey: decryptApiKey(ai) })
      const { value: site } = await getGlobal("site")
      const result = await generateText({
        model,
        system: buildBotPrompt({
          botName: settings.botName,
          siteName: site.name,
          knowledge: await loadKnowledge(),
          extra: settings.extra,
          firstName: chat.visitorName,
          today: format(new Date(), "EEEE d MMMM yyyy", { in: DUBLIN }),
        }),
        messages: toModelMessages(
          seen.map((m) => ({
            role: m.sender,
            content: m.body,
          }))
        ),
        maxOutputTokens: 300,
        abortSignal: AbortSignal.timeout(25_000),
        stopWhen: isStepCount(2),
        tools: {
          handoffToHuman: tool({
            description:
              "Ask a person from the team to take over this chat. Use when the visitor shares personal health details or asks for a person.",
            inputSchema: z.object({ reason: z.string().max(200) }),
            execute: async () => {
              handoffCalled = true
              return "The team has been asked to join."
            },
          }),
        },
      })
      text = (
        result.text ||
        result.steps
          .map((s) => s.text)
          .filter(Boolean)
          .join(" ")
      ).trim()
    } catch (error) {
      console.error("[chat] bot failed", errorTag(error))
      return fail(id)
    }
    if (!text) {
      console.error("[chat] bot failed", { name: "EmptyReply" })
      return fail(id)
    }

    const stored = await repo.addMessage({
      conversationId: id,
      sender: "ai",
      senderName: settings.botName,
      body: text,
      requireBotOwns: true,
    })
    if (!stored) return "skipped"
    replied = true
    if (handoffCalled) return handOff(id, "handoff")

    // A visitor message that landed while we generated sits before our reply.
    const after = await repo.recentForModel(id, 20)
    const before = after.slice(0, -1)
    const newer =
      before.length > seen.length
        ? before.slice(seen.length)
        : seen.length >= 20 &&
            before.at(-1)?.sender === "visitor" &&
            before.at(-1)?.body !== last.body
          ? [before.at(-1) as Hist[number]]
          : []
    if (newer.at(-1)?.sender !== "visitor") return "replied"
    history = [...seen, { sender: "ai" as const, body: text }, ...newer].slice(
      -20
    )
  }
  return "replied"
}

async function fail(id: string): Promise<"failed"> {
  await handOff(id, "failed")
  return "failed"
}

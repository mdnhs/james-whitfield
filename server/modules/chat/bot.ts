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

type Hist = {
  id: number
  sender: "visitor" | "staff" | "ai"
  body: string
}[]
type Result = { outcome: BotOutcome; handled: number }

// Three rounds of up to 25 s each, plus database and knowledge time.
const LEASE_MS = MAX_ROUNDS * 25_000 + 15_000
const MAX_ATTEMPTS = 3

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

export async function handOff(
  id: string,
  reason: AlertReason
): Promise<"handoff"> {
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
  let replied = false
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (!(await repo.claimLease(id, LEASE_MS)))
      return replied ? "replied" : "skipped"
    let r: Result
    try {
      r = await run(id)
    } finally {
      await repo.releaseLease(id)
    }
    if (r.outcome === "handoff" || r.outcome === "failed") return r.outcome
    if (r.outcome === "skipped") return replied ? "replied" : "skipped"
    replied = true
    // A visitor message may have landed after the last read and before the
    // release: its own deferred run saw the lease held and skipped.
    const hist = await repo.recentForModel(id, 20)
    const newest = hist.findLast((m) => m.sender === "visitor")
    if (!newest || newest.id <= r.handled) return "replied"
  }
  return "replied"
}

async function run(id: string): Promise<Result> {
  let handled = 0
  let replied = false
  const done = (outcome: BotOutcome): Result => ({ outcome, handled })
  const stop = () => done(replied ? "replied" : "skipped")

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const chat = await repo.byId(id)
    if (!chat || !botOwns(chat)) return stop()

    const seen: Hist = await repo.recentForModel(id, 20)
    const newest = seen.findLast((m) => m.sender === "visitor")
    if (!newest) return stop()
    let pending: Hist
    if (round === 0) {
      // Only an unanswered visitor turn, nothing after it.
      if (seen.at(-1)?.sender !== "visitor") return stop()
      const lastOther = seen.findLastIndex((m) => m.sender !== "visitor")
      pending = seen.slice(lastOther + 1)
    } else {
      // Our own reply sits after any message that arrived while we generated.
      if (newest.id <= handled) return stop()
      pending = seen.filter((m) => m.sender === "visitor" && m.id > handled)
    }

    if (pending.some((m) => isCrisis(m.body))) {
      handled = newest.id
      return done(await handOff(id, "crisis"))
    }

    const settings = await readChat()
    if (chat.aiReplyCount >= settings.maxAiReplies) {
      handled = newest.id
      return done(await handOff(id, "limit"))
    }
    const site = await hitLimit("chat-bot:global", SITE_REPLIES)
    if (!site.allowed) {
      handled = newest.id
      return done(await handOff(id, "limit"))
    }
    handled = newest.id

    let handoffCalled = false
    let text = ""
    try {
      const { value: ai } = await readAiSettings()
      const model = await getModel({ ...ai, apiKey: decryptApiKey(ai) })
      const { value: siteGlobal } = await getGlobal("site")
      const result = await generateText({
        model,
        system: buildBotPrompt({
          botName: settings.botName,
          siteName: siteGlobal.name,
          knowledge: await loadKnowledge(),
          extra: settings.extra,
          firstName: chat.visitorName,
          today: format(new Date(), "EEEE d MMMM yyyy", { in: DUBLIN }),
        }),
        messages: toModelMessages(
          seen.map((m) => ({ role: m.sender, content: m.body }))
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
      return done(await fail(id))
    }

    if (!text) {
      if (handoffCalled) return done(await handOff(id, "handoff"))
      console.error("[chat] bot failed", { name: "EmptyReply" })
      return done(await fail(id))
    }

    const stored = await repo.addMessage({
      conversationId: id,
      sender: "ai",
      senderName: settings.botName,
      body: text,
      requireBotOwns: true,
    })
    if (!stored) return stop()
    replied = true
    if (handoffCalled) return done(await handOff(id, "handoff"))
  }
  return done("replied")
}

async function fail(id: string): Promise<"failed"> {
  await handOff(id, "failed")
  return "failed"
}

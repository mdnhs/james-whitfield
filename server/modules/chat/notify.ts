import "server-only"

import { getEnv } from "@/server/env"
// Called through the namespace so tests can spy on sendEmail (ESM bindings).
import * as mail from "@/server/lib/email"
import { headerText } from "@/server/lib/email/headers"
import { errorTag } from "@/server/modules/ai/errors"
import { getGlobal } from "@/server/modules/globals/service"

import * as repo from "./repo"

export type AlertReason = "handoff" | "limit" | "failed" | "crisis"

const WHY: Record<AlertReason, string> = {
  handoff: "The assistant asked for a person to take over.",
  limit: "The assistant reached its reply limit for this chat.",
  failed: "The assistant was unavailable for this chat.",
  crisis: "The visitor may be in distress. Please look at this chat first.",
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string
  )

async function send(id: string, subject: string, why: string) {
  try {
    const chat = await repo.byId(id)
    if (!chat) return
    const [{ value: notifications }, { value: contact }] = await Promise.all([
      getGlobal("notifications"),
      getGlobal("contact"),
    ])
    const to = notifications.recipients.length
      ? notifications.recipients
      : [contact.email].filter(Boolean)
    if (!to.length) return
    const first = headerText(chat.visitorName).split(" ")[0] || "A visitor"
    const url = `${getEnv().SITE_URL}/admin/chat?c=${id}`
    let quote = ""
    if (notifications.includeMessage) {
      const last = (await repo.recentForModel(id, 20))
        .filter((m) => m.sender === "visitor")
        .at(-1)
      if (last) quote = last.body.slice(0, 500)
    }
    const text = [
      `${first} is on the chat.`,
      why,
      quote ? `Message: ${quote}` : "",
      `Open the chat: ${url}`,
    ]
      .filter(Boolean)
      .join("\n\n")
    const html = [
      `<p>${esc(first)} is on the chat.</p>`,
      `<p>${esc(why)}</p>`,
      quote ? `<p>Message: ${esc(quote)}</p>` : "",
      `<p><a href="${esc(url)}">Open the chat</a></p>`,
    ].join("")
    await mail.sendEmail({ to, subject, html, text })
  } catch (error) {
    console.error("[chat] alert email failed", errorTag(error))
  }
}

// Once per chat: the conditional UPDATE decides who sends.
export async function notifyNeedsHuman(id: string, reason: AlertReason) {
  try {
    if (!(await repo.claimNeedsHumanAlert(id))) return
  } catch (error) {
    console.error("[chat] alert guard failed", errorTag(error))
    return
  }
  await send(id, "A visitor on the chat needs a person", WHY[reason])
}

// The no-reply sweep owns its own once-only guard.
export async function notifyNoReply(id: string) {
  await send(
    id,
    "A chat visitor is waiting for a reply",
    "A visitor has been waiting for a reply."
  )
}

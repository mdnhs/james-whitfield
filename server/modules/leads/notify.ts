import "server-only"

import { eq, like } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { leadActivities, leads, users } from "@/server/db/schema"
import { getEnv } from "@/server/env"
// Called through the namespace so tests can spy on sendEmail (ESM bindings).
import * as mail from "@/server/lib/email"
import { headerText, singleAddress } from "@/server/lib/email/headers"
import {
  deliveryFailureEmail,
  enquiryAutoReplyEmail,
  newEnquiryEmail,
} from "@/server/lib/email/templates"
import { getGlobal } from "@/server/modules/globals/service"

import { optionLabels } from "./options"

type Kind = "notification" | "auto-reply"

async function attempt(leadId: string, kind: Kind, send: () => Promise<void>) {
  try {
    await send()
    await getDb()
      .insert(leadActivities)
      .values({ leadId, type: "email", data: { kind, status: "sent" } })
  } catch (error) {
    const code = error instanceof mail.EmailError ? error.code : "unknown"
    if (!(error instanceof mail.EmailError))
      console.error(`[leads] ${kind} failed`, error)
    await getDb()
      .insert(leadActivities)
      .values({
        leadId,
        type: "email",
        data: { kind, status: "failed", error: code },
      })
    await alertOwners(leadId, kind)
  }
}

async function alertOwners(leadId: string, kind: Kind) {
  // Better Auth stores roles comma-separated; '%owner%' is safe because no
  // other role name contains "owner".
  const owners = await getDb()
    .select({ email: users.email })
    .from(users)
    .where(like(users.role, "%owner%"))
  if (!owners.length) return
  const message = await deliveryFailureEmail({
    kind: kind === "auto-reply" ? "auto_reply" : "notification",
    leadUrl: leadUrl(leadId),
    occurredAt: new Date(),
  })
  await mail
    .sendEmail({
      to: owners.map((o) => o.email),
      ...message,
      idempotencyKey: `enquiry/${leadId}/delivery-failure/${kind}`,
    })
    .catch((error) =>
      console.error("[leads] delivery-failure alert failed", error)
    )
}

const leadUrl = (id: string) => `${getEnv().SITE_URL}/admin/leads?lead=${id}`

export async function notifyNewLead(leadId: string) {
  const [lead] = await getDb().select().from(leads).where(eq(leads.id, leadId))
  if (!lead || lead.status === "spam") return
  const [{ value: notifications }, { value: contact }] = await Promise.all([
    getGlobal("notifications"),
    getGlobal("contact"),
  ])
  const recipients = notifications.recipients.length
    ? notifications.recipients
    : [contact.email].filter(Boolean)
  // The name lands in subjects and the address in To/Reply-To: no line
  // breaks or control characters may reach a mail header.
  const name = headerText(lead.name)
  const address = singleAddress(lead.email)
  const labels = await optionLabels(lead)
  if (recipients.length) {
    await attempt(leadId, "notification", async () => {
      const message = await newEnquiryEmail({
        name,
        email: lead.email,
        phone: lead.phone,
        ...labels,
        message: lead.message,
        includeMessage: notifications.includeMessage,
        adminUrl: leadUrl(lead.id),
      })
      await mail.sendEmail({
        to: recipients,
        ...message,
        subject: headerText(message.subject),
        replyTo: address,
        idempotencyKey: `enquiry/${lead.id}/notify`,
      })
    })
  }
  if (
    address &&
    notifications.autoReply.enabled &&
    notifications.autoReply.subject
  ) {
    await attempt(leadId, "auto-reply", async () => {
      const message = await enquiryAutoReplyEmail({
        name,
        ...notifications.autoReply,
      })
      await mail.sendEmail({
        to: address,
        ...message,
        subject: headerText(message.subject),
        idempotencyKey: `enquiry/${lead.id}/auto-reply`,
      })
    })
  }
}

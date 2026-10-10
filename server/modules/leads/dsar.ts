import "server-only"

import { eq, sql } from "drizzle-orm"

import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { leads, newsletterSubscribers } from "@/server/db/schema"
import { hashEmail } from "@/server/lib/crypto"
import { audit } from "@/server/lib/audit"
import {
  eraseMessagesMentioning,
  exportConversationsFor,
} from "@/server/modules/ai/conversations"

import { getLeadsDetail } from "./service"

const byEmail = (email: string) => sql`lower(${leads.email}) = lower(${email})`

export async function exportPerson(actor: Actor, email: string) {
  const db = getDb()
  const ids = await db
    .select({ id: leads.id })
    .from(leads)
    .where(byEmail(email))
  const [newsletter] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email.toLowerCase()))
  const found = await getLeadsDetail(ids.map((r) => r.id))
  // Staff conversations are private to their author: the subject themselves
  // or an owner (not an admin, and not someone viewing as the subject).
  const withAi =
    actor.impersonatedBy === null &&
    (actor.roles.includes("owner") ||
      actor.email.toLowerCase() === email.toLowerCase())
  const aiConversations = withAi ? await exportConversationsFor(email) : []
  await audit(actor, {
    action: "privacy.export",
    entityType: "person",
    entityId: hashEmail(email),
    summary: `Privacy request: ${found.length} enquiries, ${newsletter ? 1 : 0} subscriptions, ${aiConversations.length} AI conversations${withAi ? "" : " (not included)"}`,
  })
  return {
    email,
    generatedAt: new Date().toISOString(),
    leads: found,
    newsletter: newsletter ?? null,
    aiConversations,
    ...(withAi
      ? {}
      : {
          aiConversationsNote:
            "AI assistant conversations are only included when the person exports their own data or an owner runs the export.",
        }),
  }
}

// lead_activities rows go with their lead (ON DELETE CASCADE).
export async function erasePerson(actor: Actor, email: string) {
  return getDb().transaction(async (tx) => {
    const gone = await tx
      .delete(leads)
      .where(byEmail(email))
      .returning({ id: leads.id })
    const subs = await tx
      .delete(newsletterSubscribers)
      .where(eq(newsletterSubscribers.email, email.toLowerCase()))
      .returning({ id: newsletterSubscribers.id })
    // Opted-in enquiry quotes in saved assistant replies (spec §6).
    const aiMessages = await eraseMessagesMentioning(tx, email)
    await audit(
      actor,
      {
        action: "privacy.erase",
        entityType: "person",
        entityId: hashEmail(email),
        summary: `Privacy request: ${gone.length} enquiries, ${subs.length} subscriptions, ${aiMessages} AI messages`,
      },
      tx
    )
    return { leads: gone.length, newsletter: subs.length, aiMessages }
  })
}

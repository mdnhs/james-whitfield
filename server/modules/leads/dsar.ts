import "server-only"

import { eq, sql } from "drizzle-orm"

import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { leads, newsletterSubscribers } from "@/server/db/schema"
import { hashEmail } from "@/server/lib/crypto"
import { audit } from "@/server/lib/audit"
import { exportConversationsFor } from "@/server/modules/ai/conversations"

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
  const aiConversations = await exportConversationsFor(email)
  await audit(actor, {
    action: "privacy.export",
    entityType: "person",
    entityId: hashEmail(email),
    summary: `Privacy request: ${found.length} enquiries, ${newsletter ? 1 : 0} subscriptions, ${aiConversations.length} AI conversations`,
  })
  return {
    email,
    generatedAt: new Date().toISOString(),
    leads: found,
    newsletter: newsletter ?? null,
    aiConversations,
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
    await audit(
      actor,
      {
        action: "privacy.erase",
        entityType: "person",
        entityId: hashEmail(email),
        summary: `Privacy request: ${gone.length} enquiries, ${subs.length} subscriptions`,
      },
      tx
    )
    return { leads: gone.length, newsletter: subs.length }
  })
}

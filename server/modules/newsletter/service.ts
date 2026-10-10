import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { and, count, desc, eq, ilike, ne, sql, type SQL } from "drizzle-orm"

import {
  NewsletterSubmission,
  type SubscriberListQuery,
} from "@/lib/leads/schema"
import { ApiError, invalid } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { newsletterSubscribers } from "@/server/db/schema"
import { getEnv } from "@/server/env"
import { audit } from "@/server/lib/audit"
import {
  hashEmail,
  hashIp,
  readUnsubscribeToken,
  unsubscribeToken,
} from "@/server/lib/crypto"
import { defer } from "@/server/lib/defer"
// Called through the namespace so tests can spy on sendEmail (ESM bindings).
import * as mail from "@/server/lib/email"
import { newsletterConfirmationEmail } from "@/server/lib/email/templates"
import { hitLimit } from "@/server/lib/rate-limit-db"
import { toCsv } from "@/server/modules/leads/csv"
import { getGlobal } from "@/server/modules/globals/service"

export { unsubscribeToken }

export const NEWSLETTER_LIMIT = { limit: 5, windowMs: 10 * 60_000 }
const CONFIRM_TTL_MS = 7 * 86_400_000

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex")

type Ctx = { ip: string | null; now?: Date }

// Every branch answers the same, so the form cannot be used to learn who is
// already on the list.
export async function subscribe(raw: unknown, ctx: Ctx) {
  const now = ctx.now ?? new Date()
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >
  if (typeof body.website === "string" && body.website.trim() !== "")
    return { ok: true as const }
  const parsed = NewsletterSubmission.safeParse(body)
  if (!parsed.success) throw invalid(parsed.error)
  const input = parsed.data
  const byEmail = await hitLimit(
    `newsletter:email:${hashEmail(input.email)}`,
    NEWSLETTER_LIMIT,
    now
  )
  if (!byEmail.allowed)
    throw new ApiError("RATE_LIMITED", "Too many requests. Try again later.")

  const [{ value: privacy }, { value: global }] = await Promise.all([
    getGlobal("privacy"),
    getGlobal("newsletter"),
  ])
  const db = getDb()
  const meta = {
    sourcePath: input.sourcePath,
    consentText: `${global.subtitle} — ${global.button}`,
    ipHash: ctx.ip ? hashIp(ctx.ip) : null,
  }
  // Never touches a row that is already confirmed.
  const notConfirmed = ne(newsletterSubscribers.status, "confirmed")

  if (!privacy.newsletterDoubleOptIn) {
    await db
      .insert(newsletterSubscribers)
      .values({
        email: input.email,
        status: "confirmed",
        confirmedAt: now,
        ...meta,
      })
      .onConflictDoUpdate({
        target: newsletterSubscribers.email,
        set: {
          status: "confirmed",
          confirmedAt: now,
          tokenHash: null,
          tokenExpiresAt: null,
          ...meta,
        },
        setWhere: notConfirmed,
      })
    return { ok: true as const }
  }

  const token = randomBytes(32).toString("base64url")
  const tokenHash = sha256(token)
  const pending = {
    status: "pending",
    tokenHash,
    tokenExpiresAt: new Date(now.getTime() + CONFIRM_TTL_MS),
    ...meta,
  }
  // An unsubscribed row returns to pending; unsubscribedAt stays as history.
  const [row] = await db
    .insert(newsletterSubscribers)
    .values({ email: input.email, ...pending })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: pending,
      setWhere: notConfirmed,
    })
    .returning({ id: newsletterSubscribers.id })
  if (row)
    defer(
      () => sendConfirmation(row.id, input.email, token, tokenHash),
      "newsletter confirmation"
    )
  return { ok: true as const }
}

async function sendConfirmation(
  id: string,
  to: string,
  token: string,
  tokenHash: string
) {
  const { value: global } = await getGlobal("newsletter")
  const site = getEnv().SITE_URL
  const message = await newsletterConfirmationEmail({
    subject: global.confirmationEmail.subject || "Confirm your subscription",
    body: global.confirmationEmail.body,
    confirmUrl: `${site}/api/v1/public/newsletter/confirm?token=${token}`,
    unsubscribeUrl: `${site}/newsletter/unsubscribe?token=${unsubscribeToken(id)}`,
  })
  await mail.sendEmail({
    to,
    ...message,
    idempotencyKey: `newsletter/${id}/confirm/${tokenHash.slice(0, 12)}`,
  })
}

// One-time: the hash is cleared on use. Only a hash is stored, so the lookup
// leaks nothing about the token itself.
export async function confirm(token: string, now = new Date()) {
  if (!token || token.length > 200) return false
  const rows = await getDb()
    .update(newsletterSubscribers)
    .set({
      status: "confirmed",
      confirmedAt: now,
      tokenHash: null,
      tokenExpiresAt: null,
    })
    .where(
      and(
        eq(newsletterSubscribers.tokenHash, sha256(token)),
        eq(newsletterSubscribers.status, "pending"),
        sql`${newsletterSubscribers.tokenExpiresAt} > ${now}`
      )
    )
    .returning({ id: newsletterSubscribers.id })
  return rows.length > 0
}

// Always resolves: a forged or unknown token looks like a real one.
export async function unsubscribe(token: string, now = new Date()) {
  const id = readUnsubscribeToken(token)
  if (!id) return
  await getDb()
    .update(newsletterSubscribers)
    .set({
      status: "unsubscribed",
      unsubscribedAt: now,
      tokenHash: null,
      tokenExpiresAt: null,
    })
    .where(
      and(
        eq(newsletterSubscribers.id, id),
        ne(newsletterSubscribers.status, "unsubscribed")
      )
    )
}

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (m) => `\\${m}`)

function filters(query: Pick<SubscriberListQuery, "status" | "q">) {
  const parts: SQL[] = []
  if (query.status) parts.push(eq(newsletterSubscribers.status, query.status))
  if (query.q)
    parts.push(ilike(newsletterSubscribers.email, `%${escapeLike(query.q)}%`))
  return and(...parts)
}

export async function listSubscribers(query: SubscriberListQuery) {
  const db = getDb()
  const where = filters(query)
  const [items, [totalRow]] = await Promise.all([
    db
      .select({
        id: newsletterSubscribers.id,
        email: newsletterSubscribers.email,
        status: newsletterSubscribers.status,
        sourcePath: newsletterSubscribers.sourcePath,
        createdAt: newsletterSubscribers.createdAt,
        confirmedAt: newsletterSubscribers.confirmedAt,
        unsubscribedAt: newsletterSubscribers.unsubscribedAt,
      })
      .from(newsletterSubscribers)
      .where(where)
      .orderBy(
        desc(newsletterSubscribers.createdAt),
        desc(newsletterSubscribers.id)
      )
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(newsletterSubscribers).where(where),
  ])
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total: totalRow?.total ?? 0,
  }
}

export async function exportSubscribers(
  actor: Actor,
  status: "all" | "confirmed"
) {
  const rows = await getDb()
    .select()
    .from(newsletterSubscribers)
    .where(
      status === "all"
        ? undefined
        : eq(newsletterSubscribers.status, "confirmed")
    )
    .orderBy(desc(newsletterSubscribers.createdAt))
  await audit(actor, {
    action: "newsletter.export",
    entityType: "newsletter",
    summary: `Subscribers exported: ${rows.length} (${status})`,
  })
  return toCsv(rows, [
    { key: "email", label: "Email" },
    { key: "status", label: "Status" },
    { key: "sourcePath", label: "Source" },
    { key: "consentText", label: "Consent text" },
    { key: "createdAt", label: "Signed up" },
    { key: "confirmedAt", label: "Confirmed" },
    { key: "unsubscribedAt", label: "Unsubscribed" },
  ])
}

export async function deleteSubscriber(actor: Actor, id: string) {
  const rows = await getDb()
    .delete(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, id))
    .returning({ id: newsletterSubscribers.id })
  if (!rows.length) throw new ApiError("NOT_FOUND", "Subscriber not found")
  await audit(actor, {
    action: "newsletter.delete",
    entityType: "newsletter",
    entityId: id,
    summary: "Subscriber removed",
  })
  return { ok: true as const }
}

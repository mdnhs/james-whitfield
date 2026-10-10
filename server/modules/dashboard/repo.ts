import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  lt,
  ne,
  sql,
} from "drizzle-orm"

import { getDb } from "@/server/db/client"
import {
  articles,
  auditLogs,
  leads,
  newsletterSubscribers,
  users,
} from "@/server/db/schema"

const notSpam = ne(leads.status, "spam")
const createdBetween = (from: Date, to: Date) =>
  and(gte(leads.createdAt, from), lt(leads.createdAt, to))

export async function enquiryCount(from: Date, to: Date) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(leads)
    .where(and(notSpam, createdBetween(from, to)))
  return row?.value ?? 0
}

// Bucketed by the Irish calendar day, so the keys match weekWindow's days.
export function enquiriesByDay(from: Date, to: Date) {
  const day = sql<string>`to_char(${leads.createdAt} at time zone 'Europe/Dublin', 'YYYY-MM-DD')`
  return getDb()
    .select({ day, count: count() })
    .from(leads)
    .where(and(notSpam, createdBetween(from, to)))
    .groupBy(day)
}

export async function articleCounts() {
  const rows = await getDb()
    .select({ status: articles.status, value: count() })
    .from(articles)
    .where(inArray(articles.status, ["published", "scheduled"]))
    .groupBy(articles.status)
  const of = (status: string) =>
    rows.find((r) => r.status === status)?.value ?? 0
  return { published: of("published"), scheduled: of("scheduled") }
}

export async function subscriberCounts(since: Date) {
  const [row] = await getDb()
    .select({
      confirmed: count(),
      recent:
        sql<number>`count(*) filter (where ${newsletterSubscribers.confirmedAt} >= ${since.toISOString()}::timestamptz)`.mapWith(
          Number
        ),
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "confirmed"))
  return { confirmed: row?.confirmed ?? 0, newThisMonth: row?.recent ?? 0 }
}

export async function oldestNewEnquiry() {
  const [row] = await getDb()
    .select({ id: leads.id, name: leads.name, createdAt: leads.createdAt })
    .from(leads)
    .where(eq(leads.status, "new"))
    .orderBy(asc(leads.createdAt), asc(leads.id))
    .limit(1)
  return row ?? null
}

// A scheduled article goes live with its draft (docs/brief.md §6.5), so the
// draft's title is the one to show.
export async function nextScheduledArticle() {
  const [row] = await getDb()
    .select({
      id: articles.id,
      title: sql<string>`coalesce(${articles.draft}->>'title', ${articles.title})`,
      scheduledFor: articles.scheduledFor,
    })
    .from(articles)
    .where(eq(articles.status, "scheduled"))
    .orderBy(asc(articles.scheduledFor))
    .limit(1)
  return row ?? null
}

export function recentAudit(limit: number) {
  return getDb()
    .select({
      id: auditLogs.id,
      actorName: users.name,
      actorEmail: auditLogs.actorEmail,
      action: auditLogs.action,
      summary: auditLogs.summary,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
}

export async function accountCount() {
  const [row] = await getDb().select({ value: count() }).from(users)
  return row?.value ?? 0
}

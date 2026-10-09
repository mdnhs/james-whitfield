import "server-only"

import { and, count, countDistinct, desc, eq, gte, lt, sql } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { auditLogs, users } from "@/server/db/schema"

const SIGN_IN = "auth.sign_in"

const between = (from: Date, to: Date) =>
  and(gte(auditLogs.createdAt, from), lt(auditLogs.createdAt, to))

// Bucketed by the Irish calendar day, so the keys match weekWindow's days.
export function signInsByDay(from: Date, to: Date) {
  const day = sql<string>`to_char(${auditLogs.createdAt} at time zone 'Europe/Dublin', 'YYYY-MM-DD')`
  return getDb()
    .select({ day, count: count() })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, SIGN_IN), between(from, to)))
    .groupBy(day)
}

export async function distinctSignedIn(from: Date, to: Date) {
  const [row] = await getDb()
    .select({ value: countDistinct(auditLogs.actorId) })
    .from(auditLogs)
    .where(and(eq(auditLogs.action, SIGN_IN), between(from, to)))
  return row?.value ?? 0
}

export async function auditCount(from: Date, to: Date) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(auditLogs)
    .where(between(from, to))
  return row?.value ?? 0
}

// Accounts that can sign in (banned ones excluded).
export function activeAccounts() {
  return getDb()
    .select({ role: users.role, twoFactorEnabled: users.twoFactorEnabled })
    .from(users)
    .where(sql`coalesce(${users.banned}, false) = false`)
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

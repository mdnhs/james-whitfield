import "server-only"

import { TZDate } from "@date-fns/tz"
import { and, asc, count, desc, eq, gte, lt, type SQL } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { auditLogs, users } from "@/server/db/schema"

export type AuditFilters = {
  actorId?: string
  action?: string
  from?: string
  to?: string
}

// Midnight at the start of an Irish calendar day (YYYY-MM-DD), plus
// `offsetDays` days; DST-safe because TZDate does the calendar maths.
export function dublinMidnight(day: string, offsetDays = 0) {
  const [year, month, date] = day.split("-").map(Number)
  return new Date(
    new TZDate(year!, month! - 1, date! + offsetDays, "Europe/Dublin").getTime()
  )
}

function where(filters: AuditFilters): SQL | undefined {
  const parts: SQL[] = []
  if (filters.actorId) parts.push(eq(auditLogs.actorId, filters.actorId))
  if (filters.action) parts.push(eq(auditLogs.action, filters.action))
  if (filters.from) {
    parts.push(gte(auditLogs.createdAt, dublinMidnight(filters.from)))
  }
  if (filters.to) {
    parts.push(lt(auditLogs.createdAt, dublinMidnight(filters.to, 1)))
  }
  return parts.length ? and(...parts) : undefined
}

export async function listAudit(
  filters: AuditFilters,
  page: number,
  pageSize: number
) {
  const db = getDb()
  const condition = where(filters)
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        actorEmail: auditLogs.actorEmail,
        actorName: users.name,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        summary: auditLogs.summary,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(condition)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(auditLogs).where(condition),
  ])
  return { items, total }
}

export async function auditFacets() {
  const db = getDb()
  const [actions, actors] = await Promise.all([
    db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .orderBy(asc(auditLogs.action)),
    db
      .selectDistinct({ id: users.id, name: users.name, email: users.email })
      .from(auditLogs)
      .innerJoin(users, eq(users.id, auditLogs.actorId))
      .orderBy(asc(users.name)),
  ])
  return {
    actions: actions.map((row) => row.action),
    actors: actors.map((row) => ({
      id: row.id,
      label: `${row.name} (${row.email})`,
    })),
  }
}

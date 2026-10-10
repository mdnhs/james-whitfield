import "server-only"

import { TZDate } from "@date-fns/tz"
import { and, asc, count, desc, eq, gte, lt, sql, type SQL } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import { getDb } from "@/server/db/client"
import { auditLogs, users } from "@/server/db/schema"

const impersonator = alias(users, "impersonator")

export type AuditFilters = {
  actorId?: string
  action?: string
  entityType?: string
  entityId?: string
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
  if (filters.entityType) {
    parts.push(eq(auditLogs.entityType, filters.entityType))
  }
  if (filters.entityId) parts.push(eq(auditLogs.entityId, filters.entityId))
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
        impersonatorName: impersonator.name,
        summary: auditLogs.summary,
        hasDiff: sql<boolean>`${auditLogs.diff} is not null`,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .leftJoin(impersonator, eq(impersonator.id, auditLogs.impersonatedBy))
      .where(condition)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(auditLogs).where(condition),
  ])
  return { items, total }
}

export async function getAudit(id: string) {
  const [row] = await getDb()
    .select({
      id: auditLogs.id,
      actorId: auditLogs.actorId,
      actorEmail: auditLogs.actorEmail,
      actorName: users.name,
      impersonatorName: impersonator.name,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      summary: auditLogs.summary,
      diff: auditLogs.diff,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .leftJoin(impersonator, eq(impersonator.id, auditLogs.impersonatedBy))
    .where(eq(auditLogs.id, id))
  return row ?? null
}

export const EXPORT_LIMIT = 10_000

export async function exportAudit(filters: AuditFilters) {
  return getDb()
    .select({
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorEmail: auditLogs.actorEmail,
      impersonatorName: impersonator.name,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      summary: auditLogs.summary,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .leftJoin(impersonator, eq(impersonator.id, auditLogs.impersonatedBy))
    .where(where(filters))
    .orderBy(desc(auditLogs.createdAt))
    .limit(EXPORT_LIMIT)
}

export async function auditFacets() {
  const db = getDb()
  const [actions, actors, entityTypes] = await Promise.all([
    db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .orderBy(asc(auditLogs.action)),
    db
      .selectDistinct({ id: users.id, name: users.name, email: users.email })
      .from(auditLogs)
      .innerJoin(users, eq(users.id, auditLogs.actorId))
      .orderBy(asc(users.name)),
    db
      .selectDistinct({ entityType: auditLogs.entityType })
      .from(auditLogs)
      .orderBy(asc(auditLogs.entityType)),
  ])
  return {
    actions: actions.map((row) => row.action),
    entityTypes: entityTypes.map((row) => row.entityType),
    actors: actors.map((row) => ({
      id: row.id,
      label: `${row.name} (${row.email})`,
    })),
  }
}

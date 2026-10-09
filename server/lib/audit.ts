import "server-only"

import { getDb, type Db } from "@/server/db/client"
import { auditLogs } from "@/server/db/schema"

import { hashIp } from "./crypto"

export type AuditActor = {
  userId: string
  email?: string | null
  ip?: string | null
  userAgent?: string | null
}

export type AuditEntry = {
  action: string
  entityType: string
  entityId?: string | null
  summary: string
  diff?: Record<string, { from: unknown; to: unknown }> | null
}

export async function audit(
  actor: AuditActor | null,
  entry: AuditEntry,
  db: Db = getDb()
) {
  await db.insert(auditLogs).values({
    actorId: actor?.userId ?? null,
    actorEmail: actor?.email ?? null,
    ipHash: actor?.ip ? hashIp(actor.ip) : null,
    userAgent: actor?.userAgent ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    diff: entry.diff ?? null,
  })
}

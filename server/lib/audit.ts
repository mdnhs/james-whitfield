import "server-only"

import { getDb, type Db } from "@/server/db/client"
import { auditLogs } from "@/server/db/schema"

import { hashIp } from "./crypto"

export type AuditActor = {
  userId: string
  email?: string | null
  // Set during View-as: the real user acting as `userId`.
  impersonatedBy?: string | null
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
    impersonatedBy: actor?.impersonatedBy ?? null,
    ipHash: actor?.ip ? hashIp(actor.ip) : null,
    // Client-supplied: bounded so a crafted header cannot bloat the log.
    userAgent: actor?.userAgent?.slice(0, 512) ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    diff: entry.diff ?? null,
  })
}

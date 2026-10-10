import "server-only"

import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { audit } from "@/server/lib/audit"
import { toCsv } from "@/server/modules/leads/csv"

import * as repo from "./repo"
import type { AuditExportQuery, AuditListQuery } from "./schema"

// Plain DTOs: ISO dates, and never the IP hash or user agent.
export async function listAuditEntries(query: AuditListQuery) {
  const { page, pageSize, actor, action, entityType, entityId, from, to } =
    query
  const { items, total } = await repo.listAudit(
    { actorId: actor, action, entityType, entityId, from, to },
    page,
    pageSize
  )
  return {
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
  }
}

export const getAuditFacets = () => repo.auditFacets()

export async function getAuditEntry(id: string) {
  const row = await repo.getAudit(id)
  if (!row)
    throw new ApiError("NOT_FOUND", "That activity entry no longer exists")
  return { ...row, createdAt: row.createdAt.toISOString() }
}

// Newest first, capped at repo.EXPORT_LIMIT rows. Never the IP hash or user agent.
export async function exportAuditCsv(actor: Actor, query: AuditExportQuery) {
  const { actor: actorId, ...rest } = query
  const rows = await repo.exportAudit({ actorId, ...rest })
  await audit(actor, {
    action: "audit.export",
    entityType: "audit",
    summary: `Exported ${rows.length} activity entr${rows.length === 1 ? "y" : "ies"}`,
  })
  return toCsv(
    rows.map((r) => ({ ...r, who: r.actorName ?? r.actorEmail ?? "System" })),
    [
      { key: "createdAt", label: "When" },
      { key: "who", label: "Who" },
      { key: "actorEmail", label: "Email" },
      { key: "impersonatorName", label: "Viewing-as by" },
      { key: "action", label: "Action" },
      { key: "entityType", label: "Entity" },
      { key: "entityId", label: "Entity ID" },
      { key: "summary", label: "Summary" },
    ]
  )
}

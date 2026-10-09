import "server-only"

import * as repo from "./repo"
import type { AuditListQuery } from "./schema"

// Plain DTOs: ISO dates, and never the IP hash or user agent.
export async function listAuditEntries(query: AuditListQuery) {
  const { page, pageSize, actor, action, from, to } = query
  const { items, total } = await repo.listAudit(
    { actorId: actor, action, from, to },
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

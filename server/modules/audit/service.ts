import "server-only"

import { count, desc } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { auditLogs } from "@/server/db/schema"

export async function listAuditEntries({
  page,
  pageSize,
}: {
  page: number
  pageSize: number
}) {
  const db = getDb()
  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(auditLogs),
  ])
  return { items, page, pageSize, total }
}

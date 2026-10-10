import "server-only"

import { sql } from "drizzle-orm"

import { getDb, type DbLike } from "@/server/db/client"

// docs/brief.md §6.6 api_rate_limits: one atomic upsert per hit, so
// concurrent requests can never both read "4" and both pass.
export async function hitLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now = new Date(),
  db: DbLike = getDb()
) {
  const resetAt = new Date(now.getTime() + windowMs)
  const { rows } = await db.execute<{ count: number; reset_at: Date }>(sql`
    insert into api_rate_limits (key, count, reset_at)
    values (${key}, 1, ${resetAt})
    on conflict (key) do update set
      count = case when api_rate_limits.reset_at <= ${now} then 1
                   else api_rate_limits.count + 1 end,
      reset_at = case when api_rate_limits.reset_at <= ${now} then excluded.reset_at
                      else api_rate_limits.reset_at end
    returning count, reset_at`)
  const row = rows[0]!
  const allowed = row.count <= limit
  const retryAfterSec = allowed
    ? 0
    : Math.max(
        1,
        Math.ceil((new Date(row.reset_at).getTime() - now.getTime()) / 1000)
      )
  return { allowed, retryAfterSec }
}

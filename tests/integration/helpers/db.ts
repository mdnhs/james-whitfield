import { sql } from "drizzle-orm"

import { getDb } from "@/server/db/client"

// Empties every application table between tests (migrations stay applied).
// Exported for reuse, e.g. E2E seeding.
export async function resetDb() {
  const db = getDb()
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`
  )
  if (rows.length === 0) return
  const tables = rows.map((row) => `"public"."${row.tablename}"`).join(", ")
  await db.execute(sql.raw(`truncate table ${tables} restart identity cascade`))
}

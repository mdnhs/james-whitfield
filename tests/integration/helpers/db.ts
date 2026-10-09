import { sql } from "drizzle-orm"

import { getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"

import { assertDisposableDatabase } from "./guard"

// Empties every application table between tests (migrations stay applied).
// Exported for reuse, e.g. E2E seeding.
export async function resetDb() {
  assertDisposableDatabase(getEnv().DATABASE_URL)
  const db = getDb()
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`
  )
  if (rows.length === 0) return
  const tables = sql.join(
    rows.map(
      (row) => sql`${sql.identifier("public")}.${sql.identifier(row.tablename)}`
    ),
    sql`, `
  )
  await db.execute(sql`truncate table ${tables} restart identity cascade`)
}

import { Pool } from "pg"

import { runMigrations } from "../../../server/db/migrate"
import { TEST_DATABASE_URL } from "../../test-env.mjs"
import { assertDisposableDatabase } from "../helpers/guard"

// Every run starts from an empty schema, so migrations are exercised from zero.
export default async function setup() {
  assertDisposableDatabase(TEST_DATABASE_URL)
  const pool = new Pool({ connectionString: TEST_DATABASE_URL })
  await pool.query("drop schema if exists public cascade")
  await pool.query("drop schema if exists drizzle cascade")
  await pool.query("create schema public")
  await pool.end()
  await runMigrations(TEST_DATABASE_URL)
}

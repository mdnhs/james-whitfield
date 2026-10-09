import { Pool, type PoolClient } from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { runMigrations } from "../../../server/db/migrate"
import { TEST_DATABASE_URL } from "../../test-env.mjs"

// Same constant as server/db/migrate.ts.
const MIGRATION_LOCK = 727_274

describe("runMigrations lock", () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 })
  let holder: PoolClient

  beforeAll(async () => {
    holder = await pool.connect()
    await holder.query("select pg_advisory_lock($1)", [MIGRATION_LOCK])
  })

  afterAll(async () => {
    holder.release()
    await pool.end()
  })

  it("fails with a clear error when the lock stays held", async () => {
    await expect(
      runMigrations(TEST_DATABASE_URL, undefined, { lockTimeoutMs: 700 })
    ).rejects.toThrow(/Timed out after 700 ms waiting for the migration lock/)
  })

  it("proceeds once the lock is released", async () => {
    await holder.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK])
    await expect(
      runMigrations(TEST_DATABASE_URL, undefined, { lockTimeoutMs: 700 })
    ).resolves.toBeUndefined()
  })
})

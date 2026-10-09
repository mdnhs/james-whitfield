import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

// Arbitrary constant. Concurrent boots (two replicas, a deploy overlapping a
// restart) queue on this lock instead of racing through the same migration.
const MIGRATION_LOCK = 727_274
const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60_000
const POLL_MS = 500

export async function runMigrations(
  databaseUrl: string,
  migrationsFolder = "server/db/migrations",
  { lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = {}
) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 })
  const client = await pool.connect()
  let locked = false
  try {
    const deadline = Date.now() + lockTimeoutMs
    let announced = false
    while (!locked) {
      const { rows } = await client.query<{ ok: boolean }>(
        "select pg_try_advisory_lock($1) as ok",
        [MIGRATION_LOCK]
      )
      locked = rows[0].ok
      if (locked) break
      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out after ${lockTimeoutMs} ms waiting for the migration lock; another instance is still migrating`
        )
      }
      if (!announced) {
        console.log("[migrate] another instance is migrating, waiting for lock")
        announced = true
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    }
    await migrate(drizzle({ client }), { migrationsFolder })
  } finally {
    if (locked) {
      await client
        .query("select pg_advisory_unlock($1)", [MIGRATION_LOCK])
        .catch(() => undefined)
    }
    client.release()
    await pool.end()
  }
}

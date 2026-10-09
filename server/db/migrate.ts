import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Pool } from "pg"

// Arbitrary constant. Concurrent boots (two replicas, a deploy overlapping a
// restart) queue on this lock instead of racing through the same migration.
const MIGRATION_LOCK = 727_274

export async function runMigrations(
  databaseUrl: string,
  migrationsFolder = "server/db/migrations"
) {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 })
  const client = await pool.connect()
  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK])
    await migrate(drizzle({ client }), { migrationsFolder })
  } finally {
    await client
      .query("select pg_advisory_unlock($1)", [MIGRATION_LOCK])
      .catch(() => undefined)
    client.release()
    await pool.end()
  }
}

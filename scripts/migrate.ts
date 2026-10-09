import { runMigrations } from "../server/db/migrate"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("[migrate] DATABASE_URL is not set")
  process.exit(1)
}

runMigrations(url, process.env.MIGRATIONS_DIR)
  .then(() => console.log("[migrate] database is up to date"))
  .catch((error: unknown) => {
    console.error("[migrate] failed", error)
    process.exit(1)
  })

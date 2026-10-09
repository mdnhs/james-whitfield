import { closeDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

// A production run is explicit. So is a run against a database that cannot be
// shown to be disposable: outside SITE_ENV development/test, only a name ending _dev, _test
// or _e2e passes without --allow-production.
const databaseName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "")
  } catch {
    return ""
  }
})()
const unsafe =
  process.env.SITE_ENV === "production" ||
  (!["development", "test"].includes(process.env.SITE_ENV ?? "") &&
    !/_(dev|test|e2e)$/.test(databaseName))
if (unsafe && !process.argv.includes("--allow-production")) {
  console.error(
    `[seed] refusing to run (SITE_ENV=${process.env.SITE_ENV ?? "unset"}, database "${databaseName}"); pass --allow-production to confirm`
  )
  process.exit(1)
}

// A running server caches "no content" for up to a minute (MISS_LIFE), so
// the site fills in shortly after this finishes; restart to see it at once.
// A seeded database is skipped; --force re-runs the idempotent inserts.
seedContent({ force: process.argv.includes("--force") })
  .then((counts) => console.log("[seed] content is in place", counts))
  .catch((error: unknown) => {
    console.error("[seed] failed", error)
    process.exitCode = 1
  })
  .finally(closeDb)

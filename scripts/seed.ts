import { closeDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"

// Only inserts rows that are missing, but a production run is still explicit.
if (
  process.env.SITE_ENV === "production" &&
  !process.argv.includes("--allow-production")
) {
  console.error(
    "[seed] refusing to run with SITE_ENV=production; pass --allow-production to confirm"
  )
  process.exit(1)
}

// A running server caches "no content" for up to a minute (MISS_LIFE), so
// the site fills in shortly after this finishes; restart to see it at once.
seedContent()
  .then((counts) => console.log("[seed] content is in place", counts))
  .catch((error: unknown) => {
    console.error("[seed] failed", error)
    process.exitCode = 1
  })
  .finally(closeDb)

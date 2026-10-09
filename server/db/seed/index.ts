import "server-only"

import { getDb, type Db } from "@/server/db/client"
import { pages } from "@/server/db/schema"

import { seedCollections } from "./collections"
import { seedGlobals } from "./globals"
import { seedMedia } from "./media"
import { seedPages } from "./pages"

// docs/brief.md §6.7. Media first: every other table references it.
// A seeded database is left alone: re-running would resurrect rows an editor
// deleted (inserts are by stable id). System pages can't be deleted, so a
// non-empty pages table means "seeded". --force re-runs the idempotent
// inserts anyway (new fixtures in development).
export async function seedContent({
  db = getDb(),
  force = false,
}: { db?: Db; force?: boolean } = {}) {
  if (!force && (await db.$count(pages)) > 0) return { skipped: true as const }
  const media = await seedMedia(db)
  await seedCollections(db)
  const pageCount = await seedPages(db)
  const globals = await seedGlobals(db)
  return { skipped: false as const, media, pages: pageCount, globals }
}

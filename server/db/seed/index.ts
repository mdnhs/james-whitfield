import "server-only"

import { getDb, type Db } from "@/server/db/client"

import { seedCollections } from "./collections"
import { seedGlobals } from "./globals"
import { seedMedia } from "./media"
import { seedPages } from "./pages"

// docs/brief.md §6.7. Media first: every other table references it.
export async function seedContent(db: Db = getDb()) {
  const media = await seedMedia(db)
  await seedCollections(db)
  const pages = await seedPages(db)
  const globals = await seedGlobals(db)
  return { media, pages, globals }
}

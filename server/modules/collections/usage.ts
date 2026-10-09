import "server-only"

import { asc } from "drizzle-orm"

import { BLOCK_BY_TYPE, type BlockType } from "@/blocks/registry"
import type { DbLike } from "@/server/db/client"
import { pages } from "@/server/db/schema"
import type { CollectionName } from "@/server/lib/cache"

type BlockLike = { type?: unknown; data?: unknown }
const blocksOf = (...documents: unknown[]): BlockLike[] =>
  documents.flatMap((doc) => {
    const blocks = (doc as { blocks?: unknown } | null)?.blocks
    return Array.isArray(blocks) ? (blocks as BlockLike[]) : []
  })

// "Used on" hints and the delete guard (docs/brief.md §9.3). A block that
// names a row (chosen ids, a band id) depends on it; an "all" block shows
// every row but survives one being deleted.
export async function collectionUsage(db: DbLike) {
  const rows = await db
    .select({
      title: pages.title,
      draft: pages.draft,
      published: pages.published,
    })
    .from(pages)
    .orderBy(asc(pages.path))
  return (tag: CollectionName, id: string) => {
    const named = new Set<string>()
    const shown = new Set<string>()
    for (const page of rows) {
      for (const block of blocksOf(page.draft, page.published)) {
        const def = BLOCK_BY_TYPE[block.type as BlockType]
        if (!def || !def.uses.includes(`collection:${tag}`)) continue
        const data = (block.data ?? {}) as {
          bandId?: unknown
          selection?: { mode?: unknown; ids?: unknown }
        }
        const chosen =
          data.selection?.mode === "chosen" && Array.isArray(data.selection.ids)
            ? data.selection.ids
            : null
        const names = data.bandId === id || (chosen?.includes(id) ?? false)
        if (names) named.add(page.title)
        if (names || (data.bandId === undefined && chosen === null))
          shown.add(page.title)
      }
    }
    return { named: [...named], shown: [...shown] }
  }
}

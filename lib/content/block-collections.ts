import { BLOCK_BY_TYPE } from "@/blocks/registry"
import type { BlockType } from "@/blocks/registry"

import { COLLECTION_NAMES, type CollectionSlug } from "./collections"

// A block's `uses` names cache tags; the admin routes use slugs.
const TAG_TO_SLUG: Record<string, CollectionSlug> = {
  bands: "cta-bands",
}

// The shared collections a block shows, for the inline items panel.
export function collectionsOf(type: BlockType): CollectionSlug[] {
  const out: CollectionSlug[] = []
  for (const use of BLOCK_BY_TYPE[type].uses) {
    if (!use.startsWith("collection:")) continue
    const tag = use.slice("collection:".length)
    const slug = TAG_TO_SLUG[tag] ?? tag
    if ((COLLECTION_NAMES as readonly string[]).includes(slug))
      out.push(slug as CollectionSlug)
  }
  return out
}

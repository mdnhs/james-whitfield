// blocks/define-block.ts
import type * as z from "zod"

// What a page is, for block placement rules. System pages have fixed keys;
// everything an editor creates is "custom".
export const PAGE_KINDS = [
  "home",
  "about",
  "services",
  "how-it-works",
  "insights",
  "contact",
  "custom",
] as const
export type PageKind = (typeof PAGE_KINDS)[number]

export type BlockDefinition<T extends string, S extends z.ZodType> = {
  type: T
  label: string
  // lucide-react icon name for the admin block library (Phase 4).
  icon: string
  schema: S
  allowedOn: "*" | readonly PageKind[]
  max?: number
  first?: boolean
  // Cache tags the block reads (docs/brief.md §5.6), for invalidation audits.
  uses: readonly string[]
}

export function defineBlock<const T extends string, S extends z.ZodType>(
  definition: BlockDefinition<T, S>
) {
  return definition
}

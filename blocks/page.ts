// blocks/page.ts
import * as z from "zod"

import { PAGE_KINDS, type PageKind } from "./define-block"
import { MediaRef } from "./fields"
import {
  BLOCKS,
  BLOCK_BY_TYPE,
  BlockId,
  BlockInstance,
  type BlockType,
} from "./registry"

export const PageDocument = z.object({
  blocks: z.array(BlockInstance).min(1).max(40),
})
export type PageDocument = z.infer<typeof PageDocument>

// Live on save, separate from the document (docs/brief.md §6.5).
export const PageSeo = z.object({
  title: z.string().trim().max(70).nullable().default(null),
  description: z.string().trim().max(200).nullable().default(null),
  ogImage: MediaRef.nullable().default(null),
  noindex: z.boolean().default(false),
})
export type PageSeo = z.infer<typeof PageSeo>

export const PageSettings = z.object({
  // Adds the footer's "Contact" chapter to the rail.
  showContactChapter: z.boolean().default(true),
  // Seeded placeholder copy (legal pages) that an editor must replace.
  needsReview: z.boolean().default(false),
})
export type PageSettings = z.infer<typeof PageSettings>

// Rules no single block can check: anchors are section ids and must be
// unique, "home" belongs to the first card, and placement/limits hold.
export function pageDocumentFor(kind: PageKind) {
  return PageDocument.superRefine((doc, ctx) => {
    const seen = new Set<string>()
    const ids = new Set<string>()
    const counts = new Map<BlockType, number>()
    doc.blocks.forEach((block, i) => {
      const def = BLOCK_BY_TYPE[block.type]
      const issue = (message: string, field: string) =>
        ctx.addIssue({ code: "custom", path: ["blocks", i, field], message })
      if (ids.has(block.id)) issue("Two blocks share this id", "id")
      ids.add(block.id)
      if (seen.has(block.anchor)) {
        issue(`Anchor "${block.anchor}" is already used on this page`, "anchor")
      }
      seen.add(block.anchor)
      // The first card is always #home (BlockRenderer). Heroes own that id and
      // render none of their own; every other section renders its anchor.
      const hero = block.type === "hero.home" || block.type === "hero.page"
      if (hero && block.anchor !== "home")
        issue('A hero\'s anchor is "home"', "anchor")
      if (!hero && block.anchor === "home") {
        issue('"home" is reserved for the page hero', "anchor")
      }
      if (i === 0 && block.joinPrevious) {
        issue("The first block cannot join a previous card", "joinPrevious")
      }
      if (def.first && i !== 0)
        issue(`${def.label} must be the first block`, "type")
      if (def.allowedOn !== "*" && !def.allowedOn.includes(kind)) {
        issue(`${def.label} is not allowed on this page`, "type")
      }
      const n = (counts.get(block.type) ?? 0) + 1
      counts.set(block.type, n)
      if (def.max && n > def.max)
        issue(`At most ${def.max} ${def.label} per page`, "type")
    })
  })
}

export function kindOf(systemKey: string | null): PageKind {
  return systemKey !== null &&
    (PAGE_KINDS as readonly string[]).includes(systemKey)
    ? (systemKey as PageKind)
    : "custom"
}

const BLOCK_TYPES = BLOCKS.map((block) => block.type) as [
  BlockType,
  ...BlockType[],
]

// The working copy autosave writes (docs/brief.md §6.5): known block types
// with any data object, so half-finished edits save. Publish is where
// pageDocumentFor applies the full schema; the site's draft reader drops
// blocks that do not parse.
export const DraftBlock = z.object({
  id: BlockId,
  type: z.enum(BLOCK_TYPES),
  anchor: z.string().max(40),
  chapter: z.string().max(24).nullable(),
  hidden: z.boolean(),
  joinPrevious: z.boolean(),
  data: z.record(z.string(), z.unknown()),
})
export type DraftBlock = z.infer<typeof DraftBlock>
export const DraftDocument = z.object({ blocks: z.array(DraftBlock).max(40) })
export type DraftDocument = z.infer<typeof DraftDocument>

// Live on save (docs/brief.md §6.5): merged field by field.
export const PageMetaPatch = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    seo: z
      .object({
        title: z.string().trim().max(70).nullable().optional(),
        description: z.string().trim().max(200).nullable().optional(),
        ogImage: MediaRef.nullable().optional(),
        noindex: z.boolean().optional(),
      })
      .strict()
      .optional(),
    settings: z
      .object({ showContactChapter: z.boolean().optional() })
      .strict()
      .optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined || v.seo !== undefined || v.settings !== undefined,
    "Nothing to change"
  )
export type PageMetaPatch = z.infer<typeof PageMetaPatch>

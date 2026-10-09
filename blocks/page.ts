// blocks/page.ts
import * as z from "zod"

import type { PageKind } from "./define-block"
import { MediaRef } from "./fields"
import { BLOCK_BY_TYPE, BlockInstance, type BlockType } from "./registry"

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
    const counts = new Map<BlockType, number>()
    doc.blocks.forEach((block, i) => {
      const def = BLOCK_BY_TYPE[block.type]
      const issue = (message: string, field: string) =>
        ctx.addIssue({ code: "custom", path: ["blocks", i, field], message })
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

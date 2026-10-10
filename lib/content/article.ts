import * as z from "zod"

import { MediaRef } from "@/blocks/fields"
import { ArticleBodyDoc } from "@/blocks/rich-text"

import { ArticleSlug } from "./article-slug"

export const ARTICLE_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "archived",
] as const
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]
export const EMPTY_BODY = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
}
export const ARTICLE_PATH_RE = /^\/insights\/[a-z0-9]+(?:-[a-z0-9]+)*$/

// What publish copies into the typed columns (docs/brief.md §6.5).
export const ArticleContent = z.object({
  title: z.string().trim().min(1).max(120),
  slug: ArticleSlug,
  excerpt: z.string().trim().min(1).max(240),
  cover: MediaRef,
  categoryId: z.uuid(),
  authorId: z.uuid(),
  featured: z.boolean(),
  body: ArticleBodyDoc,
})
export type ArticleContent = z.infer<typeof ArticleContent>

// Autosave: any half-finished state of the same shape, bounded in size.
export const ArticleDraft = z.object({
  title: z.string().max(200),
  slug: z.string().max(80),
  excerpt: z.string().max(400),
  cover: MediaRef.nullable(),
  categoryId: z.uuid().nullable(),
  authorId: z.uuid().nullable(),
  featured: z.boolean(),
  body: z.object({
    type: z.literal("doc"),
    content: z.array(z.unknown()).max(400),
  }),
})
export type ArticleDraft = z.infer<typeof ArticleDraft>

export const NewArticleInput = z.object({
  title: z.string().trim().min(1).max(120),
  categoryId: z.uuid(),
  authorId: z.uuid().optional(),
})

// Live on save, merged per field (docs/brief.md §6.5), like pages.
export const ArticleSeoPatch = z
  .object({
    title: z.string().trim().max(70).nullable().optional(),
    description: z.string().trim().max(200).nullable().optional(),
    ogImage: MediaRef.nullable().optional(),
    noindex: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change")

const Version = z.number().int().min(1)
export const ScheduleInput = z.object({
  version: Version,
  at: z.iso.datetime({ offset: true }),
})
export const UnpublishInput = z.object({
  version: Version,
  archive: z.boolean().default(false),
  // docs/brief.md §6.5: a 301 to /insights or to a chosen article.
  redirectTo: z
    .union([z.literal("/insights"), z.string().regex(ARTICLE_PATH_RE)])
    .nullable()
    .default(null),
})

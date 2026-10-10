import "server-only"

import * as z from "zod"

import { ARTICLE_STATUSES, ArticleDraft } from "@/lib/content/article"

export {
  ArticleSeoPatch,
  NewArticleInput,
  ScheduleInput,
  UnpublishInput,
} from "@/lib/content/article"

export const ArticleIdParam = z.object({ id: z.uuid() })
export const ArticleRevisionParam = z.object({ id: z.uuid(), rev: z.uuid() })
export const VersionInput = z.object({ version: z.number().int().min(1) })
export const DraftInput = VersionInput.extend({ draft: ArticleDraft })
export const ArticleListQuery = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(ARTICLE_STATUSES).optional(),
  categoryId: z.uuid().optional(),
  authorId: z.uuid().optional(),
  review: z.literal("requested").optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})
export type ArticleListQuery = z.infer<typeof ArticleListQuery>

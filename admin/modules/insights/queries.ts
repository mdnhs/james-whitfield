import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import {
  articlesApi,
  authorsApi,
  categoriesApi,
  parseResponse,
} from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import type { ArticleStatus } from "@/lib/content/article"

export type ArticleListParams = {
  q?: string
  status?: ArticleStatus
  categoryId?: string
  review?: boolean
  page?: number
  pageSize?: number
}

export const articlesListQuery = (params: ArticleListParams = {}) =>
  queryOptions({
    queryKey: queryKeys.articles.list(params),
    queryFn: () =>
      parseResponse(
        articlesApi.index.$get({
          query: {
            ...(params.q ? { q: params.q } : {}),
            ...(params.status ? { status: params.status } : {}),
            ...(params.categoryId ? { categoryId: params.categoryId } : {}),
            ...(params.review ? { review: "requested" as const } : {}),
            ...(params.page ? { page: String(params.page) } : {}),
            ...(params.pageSize ? { pageSize: String(params.pageSize) } : {}),
          },
        })
      ),
    staleTime: 15_000,
    placeholderData: (previous) => previous,
  })

export type ArticleSummaryRow = InferResponseType<
  typeof articlesApi.index.$get,
  200
>["items"][number]

export type ArticleDetail = InferResponseType<
  (typeof articlesApi)[":id"]["$get"],
  200
>

export const articleDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.articles.detail(id),
    queryFn: () => parseResponse(articlesApi[":id"].$get({ param: { id } })),
    // Fresh on every mount, like the page builder's copy.
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

export const articleRevisionsQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.articles.revisions(id),
    queryFn: () =>
      parseResponse(articlesApi[":id"].revisions.$get({ param: { id } })),
  })

// The taxonomy service types its rows loosely (one table shape for both
// lists); this is what the API actually sends.
export type TaxonomyItem = {
  id: string
  slug: string
  name: string
  version: number
  isVisible: boolean
  articleCount: number
  description?: string | null
  relatedServiceId?: string | null
  roleTitle?: string | null
  bio?: string | null
  avatar?: { mediaId: string } | null
}

export const categoriesQuery = () =>
  queryOptions({
    queryKey: queryKeys.categories,
    queryFn: () =>
      parseResponse(categoriesApi.index.$get()) as Promise<{
        items: TaxonomyItem[]
      }>,
    staleTime: 30_000,
  })

export const authorsQuery = () =>
  queryOptions({
    queryKey: queryKeys.authors,
    queryFn: () =>
      parseResponse(authorsApi.index.$get()) as Promise<{
        items: TaxonomyItem[]
      }>,
    staleTime: 30_000,
  })

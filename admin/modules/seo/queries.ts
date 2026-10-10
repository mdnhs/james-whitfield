import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { parseResponse, seoApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export type SeoOverview = InferResponseType<typeof seoApi.overview.$get, 200>
export type RedirectsPage = InferResponseType<typeof seoApi.redirects.$get, 200>
export type RedirectRow = RedirectsPage["items"][number]

export type RedirectsListParams = {
  q?: string
  page: number
  pageSize: number
}

export const seoOverviewQuery = () =>
  queryOptions({
    queryKey: queryKeys.seo.overview,
    queryFn: () => parseResponse(seoApi.overview.$get()),
  })

export const redirectsListQuery = (params: RedirectsListParams) =>
  queryOptions({
    queryKey: queryKeys.seo.redirects(params),
    queryFn: () =>
      parseResponse(
        seoApi.redirects.$get({
          query: {
            page: String(params.page),
            pageSize: String(params.pageSize),
            ...(params.q ? { q: params.q } : {}),
          },
        })
      ),
  })

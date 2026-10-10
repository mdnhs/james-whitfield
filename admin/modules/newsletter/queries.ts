import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { newsletterApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import type { SubscriberStatus } from "@/lib/leads/schema"

export type SubscribersPage = InferResponseType<
  typeof newsletterApi.index.$get,
  200
>
export type SubscriberRow = SubscribersPage["items"][number]

export type SubscribersListParams = {
  status?: SubscriberStatus
  q?: string
  page: number
  pageSize: number
}

export const subscribersListQuery = (params: SubscribersListParams) =>
  queryOptions({
    queryKey: queryKeys.newsletter.list(params),
    queryFn: () =>
      parseResponse(
        newsletterApi.index.$get({
          query: {
            page: String(params.page),
            pageSize: String(params.pageSize),
            ...(params.status ? { status: params.status } : {}),
            ...(params.q ? { q: params.q } : {}),
          },
        })
      ),
  })

// The export follows the tab: everything on "All", otherwise confirmed only.
export const exportHref = (all: boolean) =>
  `/api/v1/admin/newsletter/export.csv${all ? "?status=all" : ""}`

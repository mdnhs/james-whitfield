import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { pagesApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export type PageSummary = InferResponseType<
  typeof pagesApi.index.$get,
  200
>["items"][number]

export const pagesListQuery = () =>
  queryOptions({
    queryKey: queryKeys.pages.list,
    queryFn: () => parseResponse(pagesApi.index.$get()),
    staleTime: 30_000,
  })

export type PageDetail = InferResponseType<
  (typeof pagesApi)[":id"]["$get"],
  200
>

export const pageDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.pages.detail(id),
    queryFn: () => parseResponse(pagesApi[":id"].$get({ param: { id } })),
    // The builder owns the working copy once loaded; refetching would not
    // replace it (Builder is keyed by its generation).
    staleTime: Number.POSITIVE_INFINITY,
  })

export const pageRevisionsQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.pages.revisions(id),
    queryFn: () =>
      parseResponse(pagesApi[":id"].revisions.$get({ param: { id } })),
  })

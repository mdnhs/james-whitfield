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
    // Fresh on every mount, so a reopened builder never starts from an old
    // version. While it is open the builder owns the working copy (it is
    // keyed by its generation) and writes each save back into this cache.
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

export const pageRevisionsQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.pages.revisions(id),
    queryFn: () =>
      parseResponse(pagesApi[":id"].revisions.$get({ param: { id } })),
  })

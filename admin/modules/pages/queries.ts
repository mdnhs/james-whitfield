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

import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { parseResponse, themeApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export type ThemeAdminDoc = InferResponseType<typeof themeApi.index.$get, 200>
export type ThemeRevision = InferResponseType<
  typeof themeApi.revisions.$get,
  200
>[number]

export const themeQuery = () =>
  queryOptions({
    queryKey: queryKeys.theme.detail,
    queryFn: () => parseResponse(themeApi.index.$get()),
    staleTime: 0,
  })

export const themeRevisionsQuery = () =>
  queryOptions({
    queryKey: queryKeys.theme.revisions,
    queryFn: () => parseResponse(themeApi.revisions.$get()),
  })

export const themeColorsQuery = () =>
  queryOptions({
    queryKey: queryKeys.theme.colors,
    queryFn: () => parseResponse(themeApi.colors.$get()),
    staleTime: 5 * 60_000,
  })

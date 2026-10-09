import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { mediaApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export type MediaPage = InferResponseType<typeof mediaApi.index.$get, 200>
export type MediaItem = MediaPage["items"][number]
export type MediaListParams = {
  page?: number
  q?: string
  type?: "image" | "pdf"
  missingAlt?: boolean
  ids?: string[]
}

const toQuery = (p: MediaListParams) => ({
  pageSize: "40",
  ...(p.page ? { page: String(p.page) } : {}),
  ...(p.q ? { q: p.q } : {}),
  ...(p.type ? { type: p.type } : {}),
  ...(p.missingAlt ? { missingAlt: "1" as const } : {}),
  ...(p.ids?.length ? { ids: p.ids.join(",") } : {}),
})

export const mediaListQuery = (params: MediaListParams) =>
  queryOptions({
    queryKey: queryKeys.media.list(params),
    queryFn: () =>
      parseResponse(mediaApi.index.$get({ query: toQuery(params) })),
  })

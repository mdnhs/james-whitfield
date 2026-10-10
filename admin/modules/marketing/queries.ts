import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { parseResponse, trackingApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export type TrackingAdminDoc = InferResponseType<
  typeof trackingApi.index.$get,
  200
>

export const trackingQuery = () =>
  queryOptions({
    queryKey: queryKeys.tracking.detail,
    queryFn: () => parseResponse(trackingApi.index.$get()),
    // A form is keyed by version; always start from what is stored.
    staleTime: 0,
  })

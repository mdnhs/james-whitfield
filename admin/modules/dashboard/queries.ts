import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { dashboardApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export type Dashboard = InferResponseType<typeof dashboardApi.index.$get, 200>

export const dashboardQuery = () =>
  queryOptions({
    queryKey: queryKeys.dashboard,
    queryFn: () => parseResponse(dashboardApi.index.$get()),
  })

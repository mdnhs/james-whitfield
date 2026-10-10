import { queryOptions } from "@tanstack/react-query"

import { notificationsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { POLL_MS } from "@/lib/notifications"

// Polled every 60 s while the tab is visible (docs/plan.md Phase 11 item 2).
export const notificationsQuery = () =>
  queryOptions({
    queryKey: queryKeys.notifications,
    queryFn: () => parseResponse(notificationsApi.index.$get()),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })

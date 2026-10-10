// admin/modules/ai/queries.ts
import { queryOptions } from "@tanstack/react-query"

import { aiApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export const aiStatusQuery = () =>
  queryOptions({
    queryKey: queryKeys.ai.status,
    queryFn: () => parseResponse(aiApi.status.$get()),
    staleTime: 60_000,
  })

export const aiConversationsQuery = () =>
  queryOptions({
    queryKey: queryKeys.ai.conversations,
    queryFn: () => parseResponse(aiApi.conversations.$get()),
  })

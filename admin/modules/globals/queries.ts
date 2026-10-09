import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { globalsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import type { EditableGlobalKey } from "@/lib/content/global-access"

export type GlobalDoc = InferResponseType<
  (typeof globalsApi)[":key"]["$get"],
  200
>

export const globalQuery = (key: EditableGlobalKey) =>
  queryOptions({
    queryKey: queryKeys.globals.detail(key),
    queryFn: () => parseResponse(globalsApi[":key"].$get({ param: { key } })),
    // A form is keyed by version; always start from what is stored.
    staleTime: 0,
  })

export const globalRevisionsQuery = (key: EditableGlobalKey) =>
  queryOptions({
    queryKey: queryKeys.globals.revisions(key),
    queryFn: () =>
      parseResponse(globalsApi[":key"].revisions.$get({ param: { key } })),
  })

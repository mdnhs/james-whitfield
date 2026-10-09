import { queryOptions } from "@tanstack/react-query"

import { collectionsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import type { OptionSource } from "@/lib/content/collections"

export const collectionOptionsQuery = (source: OptionSource) =>
  queryOptions({
    queryKey: queryKeys.collections.options(source),
    queryFn: () =>
      parseResponse(
        collectionsApi[":name"].options.$get({ param: { name: source } })
      ),
    staleTime: 60_000,
  })

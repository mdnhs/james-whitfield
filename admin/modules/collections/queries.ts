import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { collectionsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import type { CollectionSlug, OptionSource } from "@/lib/content/collections"

export const collectionOptionsQuery = (source: OptionSource) =>
  queryOptions({
    queryKey: queryKeys.collections.options(source),
    queryFn: () =>
      parseResponse(
        collectionsApi[":name"].options.$get({ param: { name: source } })
      ),
    staleTime: 60_000,
  })

export const collectionListQuery = (name: CollectionSlug) =>
  queryOptions({
    queryKey: queryKeys.collections.list(name),
    queryFn: () =>
      parseResponse(collectionsApi[":name"].$get({ param: { name } })),
  })

export type CollectionItem = InferResponseType<
  (typeof collectionsApi)[":name"]["$get"],
  200
>["items"][number]

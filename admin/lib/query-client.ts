import {
  defaultShouldDehydrateQuery,
  environmentManager,
  QueryClient,
} from "@tanstack/react-query"

import { ApiError } from "./api-error"

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data prefetched on the server is not refetched the moment it
        // hydrates.
        staleTime: 30_000,
        // A 4xx will not fix itself on a retry; anything else gets one.
        retry: (failures, error) =>
          !(
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500
          ) && failures < 1,
      },
      dehydrate: {
        // Prefetches that are still running stream to the browser too.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  })
}

let browserClient: QueryClient | undefined

// A fresh client per server call (never shared between users) and one per
// browser tab, as in TanStack Query's App Router guide.
export function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient()
  browserClient ??= makeQueryClient()
  return browserClient
}

import {
  defaultShouldDehydrateQuery,
  environmentManager,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query"

import { safeNext } from "@/lib/auth/safe-next"

import { ApiError } from "./api-error"

const SIGN_IN = "/admin/sign-in"
const TWO_FACTOR_SETUP = "/admin/two-factor-setup"

// Any query or mutation that learns the session is over (or not yet allowed
// past two-factor setup) sends the whole tab there, instead of leaving each
// widget to show its own "session has ended" text. A hard navigation, like
// sign-out: nothing of the old session stays in the tab.
export function handleSessionError(error: unknown) {
  if (!(error instanceof ApiError)) return
  const { pathname, search, hash } = window.location
  if (error.code === "UNAUTHENTICATED" && pathname !== SIGN_IN) {
    const next = safeNext(`${pathname}${search}${hash}`)
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full document load on purpose: see above
    window.location.assign(`${SIGN_IN}?next=${encodeURIComponent(next)}`)
  } else if (
    error.code === "TWO_FACTOR_REQUIRED" &&
    pathname !== TWO_FACTOR_SETUP
  ) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full document load on purpose: see above
    window.location.assign(TWO_FACTOR_SETUP)
  }
}

function makeQueryClient(browser: boolean) {
  return new QueryClient({
    // Server prefetches swallow their errors; only the tab reacts to them.
    ...(browser && {
      queryCache: new QueryCache({ onError: handleSessionError }),
      mutationCache: new MutationCache({ onError: handleSessionError }),
    }),
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
  if (environmentManager.isServer()) return makeQueryClient(false)
  browserClient ??= makeQueryClient(true)
  return browserClient
}

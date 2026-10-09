import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

import { ADMIN_PATH_HEADER } from "@/lib/auth/admin-path"

// Optimistic cookie check only, never the database or server-only modules.
// Every admin layout, page and API call verifies the session itself.
const PUBLIC_ADMIN_PATHS = [
  "/admin/sign-in",
  "/admin/forgot-password",
  "/admin/reset-password",
  "/admin/two-factor",
]

const isPublic = (pathname: string) =>
  PUBLIC_ADMIN_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )

// The reset page's URL carries a live token: never leak it in a Referer.
const NO_REFERRER_PATHS = ["/admin/reset-password"]

// The path the visitor asked for, without Next's internal RSC cache-buster.
function requestedPath({ nextUrl }: NextRequest) {
  const params = new URLSearchParams(nextUrl.search)
  params.delete("_rsc")
  const query = params.toString()
  return query ? `${nextUrl.pathname}?${query}` : nextUrl.pathname
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response: NextResponse
  if (
    !isPublic(pathname) &&
    !getSessionCookie(request, { cookiePrefix: "mk" })
  ) {
    const url = new URL("/admin/sign-in", request.url)
    url.searchParams.set("next", requestedPath(request))
    response = NextResponse.redirect(url)
  } else {
    // No signed-in -> away-from-sign-in redirect: a stale cookie would loop
    // with the panel's requireActor. The sign-in page checks a real session.
    const headers = new Headers(request.headers)
    headers.set(ADMIN_PATH_HEADER, requestedPath(request))
    response = NextResponse.next({ request: { headers } })
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  if (NO_REFERRER_PATHS.some((path) => pathname === path)) {
    response.headers.set("Referrer-Policy", "no-referrer")
  }
  return response
}

export const config = { matcher: ["/admin", "/admin/:path*"] }

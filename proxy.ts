import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

import { ADMIN_PATH_HEADER } from "@/lib/auth/admin-path"
import { internalOrigin } from "@/lib/internal-origin"

// Admin: optimistic cookie check only. Insights: the redirect resolver over
// HTTP (Ruling R1). Never the database or server-only modules.
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

// Ruling R1: a renamed article's old URL must answer a real 301, which a
// streamed page cannot. The proxy asks the cached resolver over loopback and
// still never touches the database or server-only modules. Fails open.
const ARTICLE_PATH = /^\/insights\/[^/]+$/
const REDIRECT_STATUSES = [301, 302, 307, 308]

// Same-site relative paths only: never "//host" or "/\host".
const isSitePath = (value: unknown): value is string =>
  typeof value === "string" &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.startsWith("/\\")

async function articleRedirect(request: NextRequest) {
  try {
    const url = new URL("/api/v1/redirects", internalOrigin())
    url.searchParams.set("path", request.nextUrl.pathname)
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(300),
    })
    if (res.status !== 200) return null
    const { destination, statusCode } = (await res.json()) as {
      destination: unknown
      statusCode: unknown
    }
    if (!isSitePath(destination)) return null
    if (!REDIRECT_STATUSES.includes(statusCode as number)) return null
    return NextResponse.redirect(
      new URL(destination, request.url),
      statusCode as number
    )
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (ARTICLE_PATH.test(pathname)) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return NextResponse.next()
    }
    return (await articleRedirect(request)) ?? NextResponse.next()
  }

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

export const config = {
  matcher: ["/admin", "/admin/:path*", "/insights/:slug"],
}

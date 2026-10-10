import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

import { ADMIN_PATH_HEADER } from "@/lib/auth/admin-path"
import { internalOrigin } from "@/lib/internal-origin"

// Admin: optimistic cookie check only. Public pages: the cached route
// resolver over HTTP (Rulings R1–R4). Never the database or server-only
// modules.
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

const REDIRECT_STATUSES = [301, 302, 307, 308]

// Same-site relative paths only: never "//host" or "/\host".
const isSitePath = (value: unknown): value is string =>
  typeof value === "string" &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.startsWith("/\\") &&
  // The URL parser strips tab/LF/CR, so "/\t/evil" would become "//evil".
  !/[\x00-\x20\\]/.test(value)

// Ruling R1: no route matches this two-segment path, so Next renders
// app/global-not-found.tsx with a real 404 before anything streams
// (docs: file-conventions/loading.md "Status Codes").
export const NOT_FOUND_REWRITE = "/_missing/page"
// Next's draft-mode cookie: an editor previewing a draft page must reach it
// (Review Focus 1). Forging it only buys the in-shell soft 404.
const DRAFT_COOKIE = "__prerender_bypass"
const KINDS = new Set(["live", "pass", "missing", "redirect"])

type Resolution =
  | { kind: "live" | "pass" | "missing" }
  | { kind: "redirect"; destination: unknown; statusCode: unknown }

async function resolve(pathname: string): Promise<Resolution | null> {
  try {
    const url = new URL("/api/v1/resolve", internalOrigin())
    url.searchParams.set("path", pathname)
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(300),
    })
    if (res.status !== 200) return null
    const body = (await res.json()) as Resolution
    return body && KINDS.has(body.kind) ? body : null
  } catch {
    return null
  }
}

function redirectTo(
  request: NextRequest,
  destination: unknown,
  statusCode: unknown
) {
  if (!isSitePath(destination)) return null
  if (!REDIRECT_STATUSES.includes(statusCode as number)) return null
  const target = new URL(destination, request.url)
  if (target.origin !== request.nextUrl.origin) return null
  // Ruling R4: keep the visitor's query unless the destination has its own.
  if (!destination.includes("?")) {
    const params = new URLSearchParams(request.nextUrl.search)
    params.delete("_rsc")
    target.search = params.toString()
  }
  return NextResponse.redirect(target, statusCode as number)
}

// Ruling R2: every public page path asks the cached resolver over loopback.
// Fails open: on any doubt the request continues as before.
async function publicRoute(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next()
  }
  if (request.cookies.has(DRAFT_COOKIE)) return NextResponse.next()
  const hit = await resolve(request.nextUrl.pathname)
  if (hit?.kind === "missing") {
    return NextResponse.rewrite(new URL(NOT_FOUND_REWRITE, request.url), {
      status: 404,
    })
  }
  if (hit?.kind === "redirect") {
    return (
      redirectTo(request, hit.destination, hit.statusCode) ??
      NextResponse.next()
    )
  }
  return NextResponse.next()
}

const isAdmin = (pathname: string) =>
  pathname === "/admin" || pathname.startsWith("/admin/")

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!isAdmin(pathname)) return publicRoute(request)

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
  matcher: [
    "/admin",
    "/admin/:path*",
    // Every public page path; assets, the API, share cards and metadata
    // files never pay for a resolver hop. (A custom page whose address
    // starts with one of these words skips the resolver and keeps the
    // in-shell soft 404.)
    "/((?!api|_next|uploads|images|og|admin|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest).*)",
  ],
}

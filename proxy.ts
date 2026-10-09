import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

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

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  let response: NextResponse
  if (
    !isPublic(pathname) &&
    !getSessionCookie(request, { cookiePrefix: "mk" })
  ) {
    const url = new URL("/admin/sign-in", request.url)
    url.searchParams.set("next", `${pathname}${search}`)
    response = NextResponse.redirect(url)
  } else {
    // No signed-in -> away-from-sign-in redirect: a stale cookie would loop
    // with the panel's requireActor. The sign-in page checks a real session.
    response = NextResponse.next()
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  return response
}

export const config = { matcher: ["/admin", "/admin/:path*"] }

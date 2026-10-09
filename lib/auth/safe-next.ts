// Post-sign-in destinations are limited to admin paths on this origin, so
// ?next= can never become an open redirect. Browsers treat "\" like "/" and
// drop tabs and newlines, so any of those could turn "/\evil" into
// "//evil"; such values are refused outright rather than cleaned up.
const UNSAFE = /[\\\u0000-\u001f\u007f]/
const ADMIN_PATH = /^\/admin(?:[/?#]|$)/
const BASE = "http://admin.invalid"

export function safeNext(next: string | null | undefined, fallback = "/admin") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback
  if (UNSAFE.test(next)) return fallback
  let url: URL
  try {
    url = new URL(next, BASE)
  } catch {
    return fallback
  }
  // Resolving against a fixed origin normalises dot segments, so
  // "/admin/../about" is judged by where it really lands.
  if (url.origin !== BASE || !ADMIN_PATH.test(url.pathname)) return fallback
  return `${url.pathname}${url.search}${url.hash}`
}

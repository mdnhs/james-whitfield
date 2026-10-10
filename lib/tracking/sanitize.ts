// Vendor-facing URLs and titles (docs/brief.md §12.1, Rulings R6–R8).
// [prefix, collapsed path, collapsed title]. Also embedded in the inline
// bootstrap (lib/tracking/bootstrap.ts), so keep it plain data.
export const COLLAPSE = [
  ["/insights/", "/insights", "Insights"],
  ["/newsletter/", "/newsletter", "Newsletter"],
] as const

// Canonical form for matching only: decoded (twice, for %252F), lower-cased,
// backslashes and slash runs folded. Mirrored by the bootstrap's `norm`.
function normalise(pathname: string): string {
  let p = pathname
  for (let i = 0; i < 2; i++) {
    try {
      p = decodeURIComponent(p)
    } catch {
      break
    }
  }
  return p.toLowerCase().replace(/\\/g, "/").replace(/\/+/g, "/")
}

function collapsed(pathname: string) {
  const p = normalise(pathname)
  return COLLAPSE.find(([prefix]) => p.startsWith(prefix))
}

export function sanitizePath(pathname: string): string {
  return collapsed(pathname)?.[1] ?? pathname
}

export function sanitizeUrl(href: string, base?: string): string {
  // Protocol-relative inputs would resolve to a foreign host.
  if (!href || /^[/\\]{2}/.test(href)) return ""
  try {
    const url = new URL(href, base)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    return url.origin + sanitizePath(url.pathname)
  } catch {
    return ""
  }
}

export function pageTitle(pathname: string, title: string): string {
  return collapsed(pathname)?.[2] ?? title
}

// Ruling R7: the Pixel sends location.href itself, so it only runs where the
// whole URL is neutral.
export const META_ROUTES = [
  "/",
  "/about",
  "/services",
  "/how-it-works",
  "/contact",
  "/insights",
] as const

export const metaRoute = (pathname: string): boolean =>
  (META_ROUTES as readonly string[]).includes(pathname)

export function metaAllowed(loc: {
  pathname: string
  search: string
  hash: string
}): boolean {
  return !loc.search && !loc.hash && metaRoute(loc.pathname)
}

// fbevents also sends document.referrer (`rl`), so the Pixel may only run when
// the referrer is neutral too: empty, another origin, or itself allowlisted.
// An unparseable referrer is treated as not neutral.
export function referrerNeutral(referrer: string, origin: string): boolean {
  if (!referrer) return true
  try {
    const ref = new URL(referrer)
    if (ref.origin !== origin) return true
    return metaAllowed(ref)
  } catch {
    return false
  }
}

// The single gate for loading, tracking and flushing the Meta Pixel.
export function pixelAllowed(
  loc: { href: string; pathname: string; search: string; hash: string },
  referrer: string
): boolean {
  if (!metaAllowed(loc)) return false
  try {
    return referrerNeutral(referrer, new URL(loc.href).origin)
  } catch {
    return false
  }
}

// The server-side (CAPI) twin of metaAllowed: any page outside the allowlist,
// such as an owner-created landing page slug, is sent as the site root.
export function metaSourceUrl(href: string, base?: string): string {
  const clean = sanitizeUrl(href, base)
  if (!clean) return ""
  const url = new URL(clean)
  return url.origin + (metaRoute(url.pathname) ? url.pathname : "/")
}

// Vendor-facing URLs and titles (docs/brief.md §12.1, Rulings R6–R8).
// [prefix, collapsed path, collapsed title]. Also embedded in the inline
// bootstrap (lib/tracking/bootstrap.ts), so keep it plain data.
export const COLLAPSE = [
  ["/insights/", "/insights", "Insights"],
  ["/newsletter/", "/newsletter", "Newsletter"],
] as const

export function sanitizePath(pathname: string): string {
  for (const [prefix, path] of COLLAPSE) {
    if (pathname.startsWith(prefix)) return path
  }
  return pathname
}

export function sanitizeUrl(href: string, base?: string): string {
  if (!href) return ""
  try {
    const url = new URL(href, base)
    return url.origin + sanitizePath(url.pathname)
  } catch {
    return ""
  }
}

export function pageTitle(pathname: string, title: string): string {
  for (const [prefix, , label] of COLLAPSE) {
    if (pathname.startsWith(prefix)) return label
  }
  return title
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

export function metaAllowed(loc: {
  pathname: string
  search: string
  hash: string
}): boolean {
  return (
    !loc.search &&
    !loc.hash &&
    (META_ROUTES as readonly string[]).includes(loc.pathname)
  )
}

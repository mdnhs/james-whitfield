// The site answers on four addresses (http/https, with/without www). Search
// engines treat each as a separate site, so the admin picks one and proxy.ts
// sends the others to it with a 301.
export const PREFERRED_HOSTS = ["off", "apex", "www"] as const
export type PreferredHost = (typeof PREFERRED_HOSTS)[number]

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/

export const bareHost = (hostname: string): string =>
  hostname.toLowerCase().replace(/^www\./, "")

// The host the site is meant to live on, from SITE_URL. Only this site's own
// two hosts (bare and www) are ever redirected, so previews, IPs, localhost
// and health checks are left alone.
export function appHostFrom(siteUrl: string | undefined): string | null {
  if (!siteUrl) return null
  try {
    return bareHost(new URL(siteUrl).hostname)
  } catch {
    return null
  }
}

export type CanonicalHostInput = {
  // Request Host header, optionally with a port.
  host: string | null
  // x-forwarded-proto when a reverse proxy set it; null when unknown (the
  // protocol is then left alone, so a hidden one can never cause a loop).
  proto: string | null
  preferred: PreferredHost
  appHost: string | null
  pathAndSearch: string
}

// The https address the request should have been made to, or null when it
// is already right, the feature is off, or the host is not this site's own.
export function canonicalHostRedirect(i: CanonicalHostInput): string | null {
  if (i.preferred === "off" || !i.appHost || !i.host) return null
  const first = i.host.split(",")[0]!.trim().toLowerCase()
  const hostname = first.replace(/:\d+$/, "")
  if (!hostname || IPV4.test(hostname) || hostname.startsWith("[")) return null
  if (bareHost(hostname) !== i.appHost) return null
  const wanted = i.preferred === "www" ? `www.${i.appHost}` : i.appHost
  const proto = i.proto?.split(",")[0]!.trim().toLowerCase() ?? null
  if (hostname === wanted && proto !== "http") return null
  if (!i.pathAndSearch.startsWith("/") || i.pathAndSearch.startsWith("//"))
    return null
  return `https://${wanted}${i.pathAndSearch}`
}

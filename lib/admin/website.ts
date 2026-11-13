import type { CollectionSlug } from "@/lib/content/collections"

// One admin screen per public page, under the Website menu. Keys are the URL
// segment; systemKey ties each to its row in `pages` (server/db/seed/pages.ts).
export const WEBSITE_PAGES = [
  { key: "home", systemKey: "home", label: "Home" },
  { key: "about", systemKey: "about", label: "About" },
  { key: "services", systemKey: "services", label: "Services" },
  { key: "how-it-works", systemKey: "how-it-works", label: "How it works" },
  { key: "contact", systemKey: "contact", label: "Contact" },
  { key: "insights", systemKey: "insights", label: "Insights page" },
] as const

export type WebsiteKey = (typeof WEBSITE_PAGES)[number]["key"]

export const websiteHref = (key: WebsiteKey) => `/admin/website/${key}`

export function isWebsiteKey(value: string): value is WebsiteKey {
  return WEBSITE_PAGES.some((page) => page.key === value)
}

// System pages open on their Website screen; custom pages (legal, service
// details) keep the page builder at /admin/pages/<id>.
export function adminHrefForPage(page: {
  id: string
  systemKey: string | null
}): string {
  const known = WEBSITE_PAGES.find((p) => p.systemKey === page.systemKey)
  return known ? websiteHref(known.key) : `/admin/pages/${page.id}`
}

// Where each collection is edited now: on the screen of the page that shows it.
export const COLLECTION_HOME: Record<CollectionSlug, WebsiteKey> = {
  services: "services",
  plans: "services",
  testimonials: "home",
  faqs: "home",
  steps: "how-it-works",
  "cta-bands": "home",
}

// The screen a page's builder returns to: a system page to its own Website
// screen, a service's own page to Services, anything else (an unlinked
// /services/* page included) to Legal pages, the screen that lists it.
export function backLinkForPage(page: {
  systemKey: string | null
  serviceId?: string | null
}): { href: string; label: string } {
  const known = WEBSITE_PAGES.find((p) => p.systemKey === page.systemKey)
  if (known) return { href: websiteHref(known.key), label: known.label }
  if (page.serviceId)
    return { href: "/admin/website/service-pages", label: "Service pages" }
  return { href: "/admin/website/legal", label: "Legal pages" }
}

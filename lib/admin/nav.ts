import { WEBSITE_PAGES, websiteHref } from "@/lib/admin/website"
import {
  hasPermission,
  type Permissions,
  type RoleName,
} from "@/lib/auth/permissions"

// docs/brief.md §9.1. One isomorphic registry feeds the sidebar, the ⌘K
// search API and the page guard of every not-yet-built section, so a link is
// listed exactly when its page opens (Review Focus #1).
type NavGroupId = "menu" | "growth" | "general"

export type NavLink = {
  id: string
  label: string
  href: string
  permission: Permissions
  keywords?: readonly string[]
  // Extra path prefixes that keep this link highlighted (a screen that lives
  // outside its href, e.g. Insights under the Website menu).
  match?: readonly string[]
}

export type NavItem = NavLink & {
  group: NavGroupId
  children?: readonly NavLink[]
  // Phase 6 fills this with the new-enquiry count.
  badge?: "new-leads"
  // Drawn as an icon button in the sidebar's footer dock, not in the menu.
  dock?: true
}

export type Destination = NavLink & { parent: string | null }

export const NAV_GROUPS: readonly { id: NavGroupId; label: string }[] = [
  { id: "menu", label: "Menu" },
  { id: "growth", label: "Growth" },
  { id: "general", label: "General" },
]

// docs/brief.md §6.4 and §7.2: the site frame (identity, notifications,
// privacy) is `settings`, owner and admin only; the content keys (contact,
// navigation, footer, contact form and microcopy) are `globals`, which
// editors, marketers and viewers hold too.
const setting = (
  slug: string,
  label: string,
  resource: "settings" | "globals"
): NavLink => ({
  id: `settings-${slug}`,
  label,
  href: `/admin/settings/${slug}`,
  permission: { [resource]: ["read"] },
})

export const NAV: readonly NavItem[] = [
  {
    id: "dashboard",
    group: "menu",
    label: "Dashboard",
    href: "/admin",
    permission: { dashboard: ["view"] },
    keywords: ["home", "overview"],
  },
  {
    id: "website",
    group: "menu",
    label: "Website",
    href: websiteHref("home"),
    permission: { page: ["read"] },
    keywords: [
      "pages",
      "home page",
      "about",
      "services",
      "builder",
      "collections",
      "testimonials",
      "faqs",
      "plans",
      "steps",
      "blog",
      "articles",
      "legal",
      "privacy",
      "terms",
      "navigation",
      "footer",
    ],
    children: [
      ...WEBSITE_PAGES.filter((page) => page.key !== "insights").flatMap(
        (page): NavLink[] => {
          const link: NavLink = {
            id: `website-${page.key}`,
            label: page.label,
            href: websiteHref(page.key),
            permission: { page: ["read"] },
          }
          // Each service's own details page, listed like articles.
          return page.key === "services"
            ? [
                link,
                {
                  id: "website-service-pages",
                  label: "Service pages",
                  href: "/admin/website/service-pages",
                  permission: { page: ["read"] },
                  keywords: ["service details", "details page"],
                },
              ]
            : [link]
        }
      ),
      {
        id: "website-insights",
        label: "Insights",
        href: "/admin/insights",
        permission: { page: ["read"] },
        keywords: ["blog", "articles", "posts", "categories", "authors"],
        match: ["/admin/insights", "/admin/website/insights"],
      },
      {
        id: "website-legal",
        label: "Legal pages",
        href: "/admin/website/legal",
        permission: { page: ["read"] },
        keywords: ["privacy", "terms", "disclaimer"],
      },
      {
        id: "website-header-footer",
        label: "Header & footer",
        href: "/admin/website/header-footer",
        permission: { globals: ["read"] },
        keywords: ["navigation", "menu", "footer", "links"],
      },
    ],
  },
  {
    id: "media",
    group: "menu",
    label: "Media",
    href: "/admin/media",
    permission: { media: ["read"] },
    keywords: ["images", "uploads", "library"],
  },
  {
    id: "leads",
    group: "menu",
    label: "Enquiries",
    href: "/admin/leads",
    permission: { lead: ["read"] },
    keywords: ["leads", "contact", "inbox", "messages"],
    badge: "new-leads",
  },
  {
    id: "newsletter",
    group: "menu",
    label: "Newsletter",
    href: "/admin/newsletter",
    permission: { newsletter: ["read"] },
    keywords: ["subscribers", "email list"],
  },
  {
    id: "seo",
    group: "growth",
    label: "SEO",
    href: "/admin/seo",
    permission: { seo: ["read"] },
    keywords: ["search", "google", "meta", "sitemap"],
    children: [
      {
        id: "seo-overview",
        label: "Overview",
        href: "/admin/seo",
        permission: { seo: ["read"] },
      },
      {
        id: "seo-defaults",
        label: "Defaults",
        href: "/admin/seo/defaults",
        permission: { seo: ["read"] },
      },
      {
        id: "seo-redirects",
        label: "Redirects",
        href: "/admin/seo/redirects",
        permission: { redirect: ["read"] },
      },
    ],
  },
  {
    id: "marketing",
    group: "growth",
    label: "Marketing",
    href: "/admin/marketing",
    permission: { tracking: ["read"] },
    keywords: ["analytics", "gtm", "ga4", "pixel", "tracking"],
    children: [
      {
        id: "marketing-tracking",
        label: "Tracking",
        href: "/admin/marketing",
        permission: { tracking: ["read"] },
      },
      {
        id: "marketing-consent",
        label: "Consent banner",
        href: "/admin/marketing/consent",
        permission: { tracking: ["read"] },
      },
      {
        id: "marketing-events",
        label: "Event catalogue",
        href: "/admin/marketing/events",
        permission: { tracking: ["read"] },
      },
      {
        id: "marketing-code",
        label: "Custom code",
        href: "/admin/marketing/code",
        permission: { code: ["update"] },
      },
    ],
  },
  {
    id: "settings",
    group: "general",
    label: "Site settings",
    href: "/admin/settings",
    // The section opens for anyone who can open one of its pages. Every role
    // with settings.read also holds globals.read, so this is the weaker of
    // the two child gates.
    permission: { globals: ["read"] },
    keywords: ["identity", "contact", "privacy", "theme", "brand"],
    children: [
      setting("identity", "Identity", "settings"),
      setting("contact", "Contact & clinic", "globals"),
      setting("forms", "Forms & microcopy", "globals"),
      setting("notifications", "Notifications", "settings"),
      setting("privacy", "Privacy", "settings"),
      {
        id: "settings-appearance",
        label: "Appearance",
        href: "/admin/appearance",
        permission: { appearance: ["read"] },
        keywords: ["theme", "colours", "colors", "brand", "logo"],
      },
      {
        id: "settings-ai-assistant",
        label: "AI assistant",
        href: "/admin/settings/ai-assistant",
        permission: { ai: ["manage"] },
        keywords: ["ai", "gemini", "claude", "openai", "chatbot"],
      },
    ],
  },
  {
    id: "users",
    group: "general",
    label: "Users & roles",
    href: "/admin/users",
    permission: { user: ["list"] },
    dock: true,
    keywords: ["team", "invite", "people", "permissions"],
  },
  {
    id: "activity",
    group: "general",
    label: "Activity log",
    href: "/admin/activity",
    permission: { audit: ["read"] },
    dock: true,
    keywords: ["audit", "history", "changes"],
  },
]

// In the footer dock with "Log out", outside the gated navigation.
export const HELP_LINK: NavLink = {
  id: "help",
  label: "Help",
  href: "/admin/help",
  permission: { dashboard: ["view"] },
  keywords: ["support", "guide", "how to"],
}

// Not in the sidebar: reached from the user menu and ⌘K. The design showcase
// is owner-only; code.update is the one permission only owners hold.
export const EXTRA_LINKS: readonly NavLink[] = [
  {
    id: "account",
    label: "Account",
    href: "/admin/account",
    permission: { dashboard: ["view"] },
    keywords: ["profile", "password", "sessions", "security", "two-factor"],
  },
  {
    id: "design",
    label: "Design system",
    href: "/admin/design",
    permission: { code: ["update"] },
    keywords: ["components", "showcase", "kpi", "chart"],
  },
]

const allowed = (roles: readonly RoleName[], link: NavLink) =>
  hasPermission(roles, link.permission)

export function visibleNav(roles: readonly RoleName[]): NavItem[] {
  return NAV.filter((item) => allowed(roles, item)).map((item) =>
    item.children
      ? {
          ...item,
          children: item.children.filter((child) => allowed(roles, child)),
        }
      : item
  )
}

// Every page the actor may open, once each (a section's first child often
// shares its href), labelled with its section for ⌘K.
export function reachableLinks(roles: readonly RoleName[]): Destination[] {
  const seen = new Set<string>()
  const out: Destination[] = []
  const add = (link: NavLink, parent: string | null) => {
    if (seen.has(link.href)) return
    seen.add(link.href)
    out.push({ ...link, parent })
  }
  for (const item of visibleNav(roles)) {
    add(item, null)
    for (const child of item.children ?? []) add(child, item.label)
  }
  for (const link of [HELP_LINK, ...EXTRA_LINKS]) {
    if (allowed(roles, link)) add(link, null)
  }
  return out
}

// The registry entry a path stands for. Exact matches only: a section's
// sub-pages are their own entries, and unknown paths are 404s.
export function linkForPath(pathname: string): NavLink | undefined {
  for (const item of NAV) {
    if (item.href === pathname) return item
    const child = item.children?.find((link) => link.href === pathname)
    if (child) return child
  }
  return [HELP_LINK, ...EXTRA_LINKS].find((link) => link.href === pathname)
}

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`)

export function isActivePath(pathname: string, target: string | NavLink) {
  const href = typeof target === "string" ? target : target.href
  if (href === "/admin") return pathname === "/admin"
  const prefixes = typeof target === "string" ? [] : (target.match ?? [])
  return [href, ...prefixes].some((prefix) => under(pathname, prefix))
}

// A section is current on its own href or on any of its children's.
export function isActiveSection(pathname: string, item: NavItem) {
  return (
    isActivePath(pathname, item) ||
    (item.children ?? []).some((child) => isActivePath(pathname, child))
  )
}

// The gate a built page passes to requirePermission, read from the same entry
// its link is listed by. An unregistered path is a programming error (the
// page has no link), so it fails loudly rather than defaulting open or shut.
export function permissionFor(href: string): Permissions {
  const link = linkForPath(href)
  if (!link) throw new Error(`No navigation entry for ${href}`)
  return link.permission
}

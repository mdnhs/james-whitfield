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
}

export type NavItem = NavLink & {
  group: NavGroupId
  children?: readonly NavLink[]
  // Phase 6 fills this with the new-enquiry count.
  badge?: "new-leads"
}

export type Destination = NavLink & { parent: string | null }

export const NAV_GROUPS: readonly { id: NavGroupId; label: string }[] = [
  { id: "menu", label: "Menu" },
  { id: "growth", label: "Growth" },
  { id: "general", label: "General" },
]

const collection = (slug: string, label: string): NavLink => ({
  id: `collections-${slug}`,
  label,
  href: `/admin/collections/${slug}`,
  permission: { collection: ["read"] },
})

const setting = (slug: string, label: string): NavLink => ({
  id: `settings-${slug}`,
  label,
  href: `/admin/settings/${slug}`,
  permission: { settings: ["read"] },
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
    id: "pages",
    group: "menu",
    label: "Pages",
    href: "/admin/pages",
    permission: { page: ["read"] },
    keywords: ["home page", "about", "services", "builder"],
  },
  {
    id: "insights",
    group: "menu",
    label: "Insights",
    href: "/admin/insights",
    permission: { article: ["read"] },
    keywords: ["blog", "articles", "posts"],
    children: [
      {
        id: "insights-articles",
        label: "Articles",
        href: "/admin/insights",
        permission: { article: ["read"] },
      },
      {
        id: "insights-categories",
        label: "Categories",
        href: "/admin/insights/categories",
        permission: { article: ["read"] },
      },
      {
        id: "insights-authors",
        label: "Authors",
        href: "/admin/insights/authors",
        permission: { article: ["read"] },
      },
    ],
  },
  {
    id: "collections",
    group: "menu",
    label: "Collections",
    href: "/admin/collections",
    permission: { collection: ["read"] },
    keywords: ["services", "plans", "testimonials", "faqs"],
    children: [
      collection("services", "Services"),
      collection("plans", "Plans"),
      collection("testimonials", "Testimonials"),
      collection("faqs", "FAQs"),
      collection("steps", "Steps"),
      collection("cta-bands", "CTA bands"),
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
        id: "marketing-code",
        label: "Custom code",
        href: "/admin/marketing/code",
        permission: { code: ["update"] },
      },
    ],
  },
  {
    id: "appearance",
    group: "general",
    label: "Appearance",
    href: "/admin/appearance",
    permission: { appearance: ["read"] },
    keywords: ["theme", "colours", "colors", "brand", "logo"],
  },
  {
    id: "settings",
    group: "general",
    label: "Site settings",
    href: "/admin/settings",
    permission: { settings: ["read"] },
    keywords: ["identity", "contact", "footer", "navigation", "privacy"],
    children: [
      setting("identity", "Identity"),
      setting("contact", "Contact & clinic"),
      setting("navigation", "Navigation"),
      setting("footer", "Footer"),
      setting("forms", "Forms & microcopy"),
      setting("notifications", "Notifications"),
      setting("privacy", "Privacy"),
    ],
  },
  {
    id: "users",
    group: "general",
    label: "Users & roles",
    href: "/admin/users",
    permission: { user: ["list"] },
    keywords: ["team", "invite", "people", "permissions"],
  },
  {
    id: "activity",
    group: "general",
    label: "Activity log",
    href: "/admin/activity",
    permission: { audit: ["read"] },
    keywords: ["audit", "history", "changes"],
  },
]

// Sits below the groups with "Log out", outside the gated navigation.
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

export function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin"
  return pathname === href || pathname.startsWith(`${href}/`)
}

// The gate a built page passes to requirePermission, read from the same entry
// its link is listed by. An unregistered path is a programming error (the
// page has no link), so it fails loudly rather than defaulting open or shut.
export function permissionFor(href: string): Permissions {
  const link = linkForPath(href)
  if (!link) throw new Error(`No navigation entry for ${href}`)
  return link.permission
}

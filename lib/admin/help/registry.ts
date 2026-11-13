import { linkForPath } from "@/lib/admin/nav"
import { hasPermission, type RoleName } from "@/lib/auth/permissions"
import { matchesSearch } from "@/lib/search/normalize"

import { CONTENT_DOCS } from "./docs/content"
import { FAQ_DOCS } from "./docs/faq"
import { GROWTH_DOCS } from "./docs/growth"
import { INBOX_DOCS } from "./docs/inbox"
import { SETTINGS_DOCS } from "./docs/settings"
import { START_DOCS } from "./docs/start"
import { TEAM_DOCS } from "./docs/team"
import { WEBSITE_DOCS } from "./docs/website"
import type { HelpArticle, HelpBlock, HelpGroupId } from "./types"

export type { HelpArticle, HelpBlock, HelpGroupId } from "./types"

export const HELP_HREF = "/admin/help"

export const HELP_GROUPS: readonly {
  id: HelpGroupId
  label: string
  description: string
}[] = [
  {
    id: "start",
    label: "Getting started",
    description: "Signing in, finding your way and how saving works.",
  },
  {
    id: "website",
    label: "Website",
    description: "Edit the pages, services, header, footer and hero.",
  },
  {
    id: "content",
    label: "Insights & media",
    description: "Write articles and look after your images.",
  },
  {
    id: "inbox",
    label: "Enquiries & chat",
    description: "Answer enquiries, chats and newsletter sign-ups.",
  },
  {
    id: "growth",
    label: "SEO & marketing",
    description: "Search engines, redirects, tracking and consent.",
  },
  {
    id: "settings",
    label: "Site settings",
    description: "Contact details, forms, privacy, colours and AI.",
  },
  {
    id: "team",
    label: "Team & account",
    description: "Invite people, check the activity log, your account.",
  },
  {
    id: "faq",
    label: "Troubleshooting",
    description: "Quick answers when something looks wrong.",
  },
]

// Sidebar order: group by group, articles in the order each file lists them.
export const HELP_ARTICLES: readonly HelpArticle[] = HELP_GROUPS.flatMap(
  (group) =>
    [
      ...START_DOCS,
      ...WEBSITE_DOCS,
      ...CONTENT_DOCS,
      ...INBOX_DOCS,
      ...GROWTH_DOCS,
      ...SETTINGS_DOCS,
      ...TEAM_DOCS,
      ...FAQ_DOCS,
    ].filter((article) => article.group === group.id)
)

export const helpHref = (slug: string) => `${HELP_HREF}/${slug}`

export function helpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug)
}

export function canReadArticle(
  roles: readonly RoleName[],
  article: HelpArticle
): boolean {
  return !article.permission || hasPermission(roles, article.permission)
}

// Articles about screens the viewer cannot open are left out entirely.
export function visibleArticles(roles: readonly RoleName[]): HelpArticle[] {
  return HELP_ARTICLES.filter((article) => canReadArticle(roles, article))
}

export function groupedArticles(roles: readonly RoleName[]) {
  const visible = visibleArticles(roles)
  return HELP_GROUPS.map((group) => ({
    ...group,
    articles: visible.filter((article) => article.group === group.id),
  })).filter((group) => group.articles.length > 0)
}

// The previous and next article in sidebar order, among those visible.
export function neighbours(roles: readonly RoleName[], slug: string) {
  const visible = visibleArticles(roles)
  const at = visible.findIndex((article) => article.slug === slug)
  if (at === -1) return { prev: undefined, next: undefined }
  return { prev: visible[at - 1], next: visible[at + 1] }
}

// "Saving vs publishing" -> "saving-vs-publishing": a section's anchor.
export const headingId = (title: string) =>
  title
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

export type TocEntry = { id: string; title: string; level: 2 | 3 }

// "On this page": one entry per section heading, in order, h3s indented.
export function tocFor(article: HelpArticle): TocEntry[] {
  return article.sections.map((section) => ({
    id: headingId(section.title),
    title: section.title,
    level: section.level ?? 2,
  }))
}

// Every string a block holds, for search and the link checks.
function blockTexts(block: HelpBlock): string[] {
  switch (block.type) {
    case "p":
    case "callout":
      return [block.text]
    case "steps":
    case "list":
      return [...block.items]
    case "open":
      return [`[${block.label}](${block.href})`]
  }
}

export function articleTexts(article: HelpArticle): string[] {
  return article.sections.flatMap((section) => [
    section.title,
    ...section.blocks.flatMap(blockTexts),
  ])
}

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g

// Every href an article links to, in-text links and "open" buttons alike.
export function articleLinks(article: HelpArticle): string[] {
  return articleTexts(article).flatMap((text) =>
    [...text.matchAll(LINK)].map((match) => match[2]!)
  )
}

// Whether the viewer may follow a link: another help article they can read,
// or an admin screen their role opens. Anything else renders as plain text.
export function canFollow(roles: readonly RoleName[], href: string): boolean {
  const path = href.split("#")[0]!
  if (path === HELP_HREF) return true
  if (path.startsWith(`${HELP_HREF}/`)) {
    const article = helpArticle(path.slice(HELP_HREF.length + 1))
    return article ? canReadArticle(roles, article) : false
  }
  const link = linkForPath(path)
  return link ? hasPermission(roles, link.permission) : false
}

// The ⌘K hits: title, description and keywords only, so a query lands on
// the article about it rather than every one that mentions it.
export function searchHelp(roles: readonly RoleName[], q: string) {
  if (!q.trim()) return []
  return visibleArticles(roles).filter((article) =>
    matchesSearch(q, [
      article.title,
      article.description,
      ...(article.keywords ?? []),
    ])
  )
}

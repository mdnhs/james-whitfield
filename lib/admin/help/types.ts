import type { Permissions } from "@/lib/auth/permissions"

// The admin's own help docs (/admin/help). Plain data, no React, so the ⌘K
// search service and the tests read the same registry the pages render.
//
// Inline text uses a tiny markup, rendered by admin/modules/help/inline.tsx:
//   **Exact UI label**        bold
//   `⌘K`                      a keyboard hint
//   [Open Media →](/admin/media)  a link (admin screens or /admin/help/<slug>)

export type HelpGroupId =
  | "start"
  | "website"
  | "content"
  | "inbox"
  | "growth"
  | "settings"
  | "team"
  | "faq"

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "steps"; items: readonly string[] }
  | { type: "list"; items: readonly string[] }
  | { type: "callout"; tone: "tip" | "note" | "warning"; text: string }
  // A button-style link to the admin screen the article is about.
  | { type: "open"; href: string; label: string }

export type HelpSection = {
  title: string
  // 3: a sub-heading (h3) under the section before it. Default 2 (h2).
  level?: 2 | 3
  blocks: readonly HelpBlock[]
}

export type HelpArticle = {
  slug: string
  title: string
  group: HelpGroupId
  // One line for cards, the sidebar's tooltip and search.
  description: string
  // The paragraph under the title.
  lead: string
  // Who can open the screens this article is about. Omitted: everyone.
  permission?: Permissions
  keywords?: readonly string[]
  sections: readonly HelpSection[]
}

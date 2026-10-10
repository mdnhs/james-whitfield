import "server-only"

import { revalidateTag } from "next/cache"

export type CollectionName =
  "services" | "plans" | "testimonials" | "faqs" | "steps" | "bands"

// The cache tag catalogue (docs/brief.md §5.6). Queries tag what they read;
// services invalidate what they write.
export const tags = {
  setting: (key: string) => `settings:${key}`,
  page: (id: string) => `page:${id}`,
  routes: "routes",
  articles: "articles",
  article: (id: string) => `article:${id}`,
  categories: "categories",
  authors: "authors",
  collection: (name: CollectionName) => `collection:${name}`,
  media: "media",
  redirects: "redirects",
} as const

// What every redirect write expires: the redirect rows and the route table
// the resolver builds from them.
export const REDIRECT_TAGS = [tags.redirects, tags.routes] as const

// "Nothing here" is cached briefly: content seeded or published after the
// first visit must appear without a restart (and publishing invalidates the
// tags these entries carry anyway).
export const MISS_LIFE = { stale: 30, revalidate: 30, expire: 60 } as const

// Route Handlers cannot use updateTag; { expire: 0 } means the next request
// re-renders instead of being served stale content.
export function invalidate(list: readonly string[]) {
  for (const tag of new Set(list)) revalidateTag(tag, { expire: 0 })
}

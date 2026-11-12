import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { tags } from "@/server/lib/cache"

import type { LlmsEntry } from "@/lib/seo/llms"

import { computeSeoHealth } from "./health"
import { isIndexable, listCategoryHubs, listLiveEntities } from "./live"

// Callers have awaited connection(): the build has no database.
export async function getSitemapEntries() {
  "use cache"
  cacheTag(tags.routes, tags.articles, tags.categories)
  cacheLife("max")
  const [live, hubs] = await Promise.all([
    listLiveEntities(),
    listCategoryHubs(),
  ])
  // Page SEO saves expire only page:<id> (noindex, canonical live there).
  for (const e of live) if (e.kind === "page") cacheTag(tags.page(e.id))
  return [
    ...live
      .filter(isIndexable)
      .map((e) => ({ path: e.path, lastModified: e.updatedAt.toISOString() })),
    ...hubs.map((h) => ({
      path: h.path,
      lastModified: h.updatedAt.toISOString(),
    })),
  ]
}

// Same entities and tags as the sitemap, with the text llms.txt lists.
export async function getLlmsEntries(): Promise<LlmsEntry[]> {
  "use cache"
  cacheTag(tags.routes, tags.articles, tags.categories)
  cacheLife("max")
  const [live, hubs] = await Promise.all([
    listLiveEntities(),
    listCategoryHubs(),
  ])
  for (const e of live) if (e.kind === "page") cacheTag(tags.page(e.id))
  return [
    ...live.map((e) => ({
      kind: e.kind,
      path: e.path,
      title: e.seo.title || e.title,
      description: e.seo.description || e.summary || "",
      noindex: !isIndexable(e),
    })),
    ...hubs.map((h) => ({
      kind: "page" as const,
      path: h.path,
      title: h.title,
      description: h.description,
      noindex: false,
    })),
  ]
}

// Ruling R11: cached; page SEO saves expire page:<id>, article SEO saves
// expire `articles`, media edits `media`, defaults `settings:seo`.
export async function getSeoHealth() {
  "use cache"
  cacheTag(tags.routes, tags.articles, tags.media, tags.setting("seo"))
  cacheLife("max")
  const live = await listLiveEntities()
  for (const e of live) if (e.kind === "page") cacheTag(tags.page(e.id))
  return computeSeoHealth(undefined, undefined, live)
}

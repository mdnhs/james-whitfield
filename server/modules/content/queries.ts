import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import {
  parseGlobal,
  type GlobalValue,
  type PublicGlobalKey,
} from "@/lib/content/globals"
import { MISS_LIFE, tags, type CollectionName } from "@/server/lib/cache"

import * as repo from "./repo"

// Callers must `await io()` first (docs/brief.md §5.6): these run at build
// otherwise, and the build has no database.
const lifetime = (found: boolean) =>
  found ? cacheLife("max") : cacheLife(MISS_LIFE)

export async function getMedia(ids: string[]) {
  "use cache"
  cacheTag(tags.media)
  const unique = [...new Set(ids)]
  const assets = await repo.findMedia(unique)
  lifetime(assets.size === unique.length)
  return assets
}

export async function getPublishedPage(path: string) {
  "use cache"
  // Draft mode may be read inside a cache scope; Next then skips storing.
  const { isEnabled: draft } = await draftMode()
  cacheTag(tags.routes)
  const page = await repo.findPageByPath(path, { draft })
  if (page) cacheTag(tags.page(page.id))
  lifetime(page !== null)
  return page
}

export async function getSetting<K extends PublicGlobalKey>(
  key: K
): Promise<GlobalValue<K>> {
  "use cache"
  cacheTag(tags.setting(key))
  const { isEnabled: draft } = await draftMode()
  const row = await repo.findSetting(key)
  lifetime(row !== null)
  return parseGlobal(key, draft && row?.draft != null ? row.draft : row?.value)
}

// Runs inside the caller's cache scope, so its tag and lifetime apply there.
const collection = async <T>(
  name: CollectionName,
  load: () => Promise<T[]>
) => {
  cacheTag(tags.collection(name))
  const rows = await load()
  lifetime(rows.length > 0)
  return rows
}

export async function getServices() {
  "use cache"
  return collection("services", repo.listServices)
}
export async function getPlans() {
  "use cache"
  return collection("plans", repo.listPlans)
}
export async function getTestimonials() {
  "use cache"
  cacheTag(tags.media)
  return collection("testimonials", repo.listTestimonials)
}
export async function getFaqs() {
  "use cache"
  return collection("faqs", repo.listFaqs)
}
export async function getProcessSteps() {
  "use cache"
  cacheTag(tags.media)
  return collection("steps", repo.listProcessSteps)
}

export async function getCtaBand(id: string) {
  "use cache"
  cacheTag(tags.collection("bands"), tags.media)
  const band = await repo.findCtaBand(id)
  lifetime(band !== null)
  return band
}

export async function getCategories() {
  "use cache"
  cacheTag(tags.categories)
  const rows = await repo.listCategories()
  lifetime(rows.length > 0)
  return rows
}

// Articles join categories, authors, media and (for the CTA topic) services.
const ARTICLE_TAGS = [
  tags.articles,
  tags.categories,
  tags.authors,
  tags.media,
  tags.collection("services"),
]

export async function getArticleSummaries() {
  "use cache"
  cacheTag(...ARTICLE_TAGS)
  const rows = await repo.listArticleSummaries()
  lifetime(rows.length > 0)
  return rows
}

export async function getArticle(slug: string) {
  "use cache"
  cacheTag(...ARTICLE_TAGS)
  const article = await repo.findArticleBySlug(slug)
  if (article) cacheTag(tags.article(article.id))
  lifetime(article !== null)
  return article
}

// Same category first, then the newest of the rest (the old helper's rule).
export async function getRelatedArticles(slug: string, count: number) {
  "use cache"
  cacheTag(...ARTICLE_TAGS)
  const all = await repo.listArticleSummaries()
  const current = all.find((a) => a.slug === slug)
  const others = all.filter((a) => a.slug !== slug)
  lifetime(all.length > 0)
  return [
    ...others.filter((a) => a.category.slug === current?.category.slug),
    ...others.filter((a) => a.category.slug !== current?.category.slug),
  ].slice(0, count)
}

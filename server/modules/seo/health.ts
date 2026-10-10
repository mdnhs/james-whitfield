import "server-only"

import { eq, inArray } from "drizzle-orm"

import { collectMediaIds } from "@/blocks/media-refs"
import type { PageDocument } from "@/blocks/page"
import { parseGlobal } from "@/lib/content/globals"
import { runChecks, type CheckId } from "@/lib/seo/checks"
import { blank } from "@/lib/seo/metadata"
import { documentTitle } from "@/lib/seo/title"
import { getDb, type DbLike } from "@/server/db/client"
import { media, settings } from "@/server/db/schema"
import { getEnv } from "@/server/env"

import { listLiveEntities, type LiveEntity } from "./live"

// Blocks whose component renders the page's <h1> (components/page-hero.tsx,
// features/hero/components/hero-content.tsx). Rich text only allows h2/h3
// (blocks/rich-text.ts Heading), so a custom page needs a hero for its h1.
const H1_BLOCKS = new Set(["hero.home", "hero.page"])
// Blocks that always render links to other pages (cards, CTAs).
const LINKING_BLOCKS = new Set([
  "insights.latest",
  "insights.browser",
  "band",
  "services.plans",
])

// Every string under an "href" key, and every rich-text link mark.
function hrefs(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => hrefs(v, out))
  else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if (key === "href" && typeof v === "string") out.push(v)
      else hrefs(v, out)
    }
  }
  return out
}
const isInternal = (href: string, origin: string) =>
  href.startsWith("/") || href.startsWith(origin)

const visibleBlocks = (e: LiveEntity) =>
  (e.document as PageDocument).blocks.filter((b) => !b.hidden)

function hasH1(e: LiveEntity) {
  if (e.kind === "article") return true // ArticleHero renders the title as <h1>.
  return visibleBlocks(e).some((b) => H1_BLOCKS.has(b.type))
}

function internalLinks(e: LiveEntity, origin: string) {
  if (e.kind === "article")
    return hrefs(e.body).filter((h) => isInternal(h, origin)).length
  const blocks = visibleBlocks(e)
  return (
    blocks.filter((b) => LINKING_BLOCKS.has(b.type)).length +
    hrefs(blocks.map((b) => b.data)).filter((h) => isInternal(h, origin)).length
  )
}

const fixHref = (e: LiveEntity) =>
  e.kind === "page"
    ? `/admin/pages/${e.id}?tab=seo`
    : `/admin/insights/${e.id}?tab=seo`

export type SeoIssue = {
  kind: "page" | "article" | "media"
  id: string
  title: string
  path: string | null
  check: CheckId
  message: string
  fixHref: string
}
export type SeoHealth = {
  score: number
  passed: number
  total: number
  entities: number
  issues: SeoIssue[]
  alt: {
    images: number
    described: number
    decorative: number
    missing: number
  }
}

export async function computeSeoHealth(
  db: DbLike = getDb(),
  origin = getEnv().SITE_URL.replace(/\/$/, ""),
  // Callers that already loaded the live content pass it in.
  liveEntities?: LiveEntity[]
): Promise<SeoHealth> {
  const [live, [seoRow]] = await Promise.all([
    liveEntities ?? listLiveEntities(db),
    db.select().from(settings).where(eq(settings.key, "seo")).limit(1),
  ])
  const seo = parseGlobal("seo", seoRow?.value)
  // An article's cover is a column, not part of its body.
  const idsOf = (e: LiveEntity) => [
    ...collectMediaIds(e.kind === "page" ? e.document : e.body),
    ...(e.coverId ? [e.coverId] : []),
  ]
  const allIds = [
    ...new Set(
      live.flatMap((e) => [
        ...idsOf(e),
        ...(e.seo.ogImage ? [e.seo.ogImage.mediaId] : []),
      ])
    ),
  ]
  const rows = allIds.length
    ? await db
        .select({
          id: media.id,
          alt: media.alt,
          isDecorative: media.isDecorative,
          width: media.width,
          height: media.height,
          filename: media.filename,
        })
        .from(media)
        .where(inArray(media.id, allIds))
    : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  const missingAlt = (id: string) => {
    const r = byId.get(id)
    return r !== undefined && !r.isDecorative && r.alt.trim() === ""
  }
  const titles = live.map((e) =>
    documentTitle({ home: e.home, title: e.title, seoTitle: e.seo.title }, seo)
  )
  const issues: SeoIssue[] = []
  let passed = 0
  let total = 0
  live.forEach((e, i) => {
    const og = e.seo.ogImage ? byId.get(e.seo.ogImage.mediaId) : undefined
    const results = runChecks({
      title: titles[i]!,
      titleUnique:
        titles.indexOf(titles[i]!) === titles.lastIndexOf(titles[i]!),
      description: blank(e.seo.description) ?? e.summary,
      ogImage:
        og && og.width && og.height
          ? { width: og.width, height: og.height }
          : null,
      imagesMissingAlt: idsOf(e).filter(missingAlt).length,
      hasH1: hasH1(e),
      noindex: e.seo.noindex,
      internalLinks: internalLinks(e, origin),
    })
    for (const r of results) {
      total++
      if (r.ok) passed++
      else
        issues.push({
          kind: e.kind,
          id: e.id,
          title: e.title,
          path: e.path,
          check: r.id,
          message: r.message,
          fixHref: fixHref(e),
        })
    }
  })
  // One issue per undescribed image too, linking to the media library.
  for (const r of rows) {
    if (!r.isDecorative && r.alt.trim() === "") {
      issues.push({
        kind: "media",
        id: r.id,
        title: r.filename,
        path: null,
        check: "alt-text",
        message: "Image has no alt text",
        fixHref: `/admin/media?missingAlt=true&q=${encodeURIComponent(r.filename)}`,
      })
    }
  }
  return {
    score: total ? Math.round((passed / total) * 100) : 100,
    passed,
    total,
    entities: live.length,
    issues,
    alt: {
      images: rows.length,
      described: rows.filter((r) => r.alt.trim() !== "").length,
      decorative: rows.filter((r) => r.isDecorative).length,
      missing: rows.filter((r) => !r.isDecorative && r.alt.trim() === "")
        .length,
    },
  }
}

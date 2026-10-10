import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"

import { buildMetadata } from "@/lib/seo/metadata"
import {
  getMedia,
  getPublishedPage,
  getSetting,
} from "@/server/modules/content/queries"
import { isPreviewing } from "@/server/modules/content/preview"

import { BlockRenderer } from "./block-renderer"
import { seoDefaults } from "./seo-defaults"

// Inside the layout's Suspense (SiteFrame). io() keeps the read out of the
// build; the redirect lookup arrives with Phase 7.
//
// Each known path has its own route segment rather than one [...slug]
// catch-all: unknown multi-segment URLs then 404 with a real status before
// any shell streams (one unknown segment reaches app/(site)/[page]), and the client router never reuses one CMS page's segment for
// another. A route whose page is missing or unpublished renders not-found
// inside the streamed shell (200 + noindex): a real status there would need
// proxy, which may not read the database.
export async function CmsPage({ path }: { path: string }) {
  await io()
  const draft = await isPreviewing()
  const [page, copy] = await Promise.all([
    getPublishedPage(path, draft),
    getSetting("microcopy"),
  ])
  if (!page) notFound()
  return <BlockRenderer page={page} contactLabel={copy.contactChapter} />
}

// Metadata blocks for every agent (htmlLimitedBots), so a missing page puts
// noindex in the head; the status stays 200 (see the note above CmsPage).
export async function cmsMetadata(path: string): Promise<Metadata> {
  await io()
  const draft = await isPreviewing()
  const page = await getPublishedPage(path, draft)
  if (!page) notFound()
  const ogId = page.seo.ogImage?.mediaId
  const [defaults, assets] = await Promise.all([
    seoDefaults(),
    ogId ? getMedia([ogId]) : Promise.resolve(new Map()),
  ])
  // A deleted share image falls back to the generated card.
  return buildMetadata(
    {
      path: page.path,
      home: page.systemKey === "home",
      kind: "page",
      title: page.title,
      summary: null,
      eyebrow: null,
      seo: page.seo,
      ogImage: ogId ? (assets.get(ogId) ?? null) : null,
      draft,
    },
    defaults
  )
}

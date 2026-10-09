import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"

import { getPublishedPage, getSetting } from "@/server/modules/content/queries"

import { BlockRenderer } from "./block-renderer"

// Inside the layout's Suspense (SiteFrame). io() keeps the read out of the
// build; the redirect lookup arrives with Phase 7.
//
// Each known path has its own route segment rather than one [...slug]
// catch-all: unknown URLs then 404 with a real status before any shell
// streams, and the client router never reuses one CMS page's segment for
// another. A route whose page is missing or unpublished renders not-found
// inside the streamed shell (200 + noindex): a real status there would need
// proxy, which may not read the database.
export async function CmsPage({ path }: { path: string }) {
  await io()
  const [page, copy] = await Promise.all([
    getPublishedPage(path),
    getSetting("microcopy"),
  ])
  if (!page) notFound()
  return <BlockRenderer page={page} contactLabel={copy.contactChapter} />
}

// Metadata blocks for every agent (htmlLimitedBots), so a notFound() here
// runs before the body streams and the response is a real 404.
export async function cmsMetadata(path: string): Promise<Metadata> {
  await io()
  const page = await getPublishedPage(path)
  if (!page) notFound()
  const description = page.seo.description ?? undefined
  // The home page keeps the site's default title (root layout).
  return page.systemKey === "home"
    ? { description }
    : { title: page.seo.title ?? page.title, description }
}

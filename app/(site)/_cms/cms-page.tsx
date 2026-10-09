import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"

import {
  getMedia,
  getPublishedPage,
  getSetting,
} from "@/server/modules/content/queries"

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

// Metadata blocks for every agent (htmlLimitedBots), so a missing page puts
// noindex in the head; the status stays 200 (see the note above CmsPage).
export async function cmsMetadata(path: string): Promise<Metadata> {
  await io()
  const page = await getPublishedPage(path)
  if (!page) notFound()
  const { seo } = page
  const ogId = seo.ogImage?.mediaId
  // A deleted share image drops the tag rather than failing the page.
  const og = ogId ? (await getMedia([ogId])).get(ogId) : undefined
  return {
    // The home page keeps the site's default title (root layout).
    ...(page.systemKey === "home" ? {} : { title: seo.title ?? page.title }),
    description: seo.description ?? undefined,
    ...(seo.noindex ? { robots: { index: false } } : {}),
    ...(og
      ? {
          openGraph: {
            images: [
              { url: og.src, width: og.width, height: og.height, alt: og.alt },
            ],
          },
        }
      : {}),
  }
}

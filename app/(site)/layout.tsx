import type { Metadata } from "next"
import { io } from "next/cache"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { Suspense } from "react"
import { preload } from "react-dom"

import { AttributionCapture } from "@/components/attribution-capture"
import { getEnv } from "@/server/env"
import { iconVersion } from "@/lib/seo/icons"
import { rootMetadata } from "@/lib/seo/metadata"
import { getMedia, getSetting } from "@/server/modules/content/queries"

import { SiteFrame } from "./_cms/site-frame"
import { siteFontClassName } from "./fonts"

import "./site.css"

export async function generateMetadata(): Promise<Metadata> {
  await io()
  const [seo, site] = await Promise.all([getSetting("seo"), getSetting("site")])
  const ids = [site.icon?.mediaId, seo.defaultOgImage?.mediaId].filter(
    (id): id is string => Boolean(id)
  )
  const assets = ids.length ? await getMedia(ids) : new Map()
  const icon = (site.icon && assets.get(site.icon.mediaId)) ?? null
  return rootMetadata({
    siteUrl: getEnv().SITE_URL,
    seo,
    siteName: site.name,
    iconVersion: icon ? iconVersion(icon.src) : null,
    defaultOgImage:
      (seo.defaultOgImage && assets.get(seo.defaultOgImage.mediaId)) ?? null,
  })
}

// The public site has a single light design. The admin has its own root
// layout with light/dark support, so next-themes is not used here.
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The header's CSS background is the LCP element on every page; preloaded
  // from the static shell it is decoded in time for the first paint.
  preload("/images/hero/navbar-bg.png", { as: "image", fetchPriority: "high" })
  return (
    <html lang="en-IE" className={siteFontClassName}>
      <body>
        <noscript>
          <style>{"[data-reveal]{visibility:visible!important}"}</style>
        </noscript>
        <NuqsAdapter>
          <AttributionCapture />
          <Suspense fallback={null}>
            <SiteFrame>{children}</SiteFrame>
          </Suspense>
        </NuqsAdapter>
      </body>
    </html>
  )
}

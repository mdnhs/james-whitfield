import type { Metadata } from "next"
import { io } from "next/cache"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { Suspense } from "react"

import { getEnv } from "@/server/env"
import { getSetting } from "@/server/modules/content/queries"

import { SiteFrame } from "./_cms/site-frame"
import { siteFontClassName } from "./fonts"

import "./site.css"

// Root metadata: metadataBase fixes og:image URLs, and the title template
// comes from the SEO global (Phase 7 adds the rest).
export async function generateMetadata(): Promise<Metadata> {
  await io()
  const seo = await getSetting("seo")
  return {
    metadataBase: new URL(getEnv().SITE_URL),
    title: seo.titleTemplate
      ? { default: seo.defaultTitle, template: seo.titleTemplate }
      : seo.defaultTitle,
    description: seo.defaultDescription || undefined,
  }
}

// The public site has a single light design. The admin has its own root
// layout with light/dark support, so next-themes is not used here.
export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IE" className={siteFontClassName}>
      <body>
        <noscript>
          <style>{"[data-reveal]{visibility:visible!important}"}</style>
        </noscript>
        <NuqsAdapter>
          <Suspense fallback={null}>
            <SiteFrame>{children}</SiteFrame>
          </Suspense>
        </NuqsAdapter>
      </body>
    </html>
  )
}

import { NuqsAdapter } from "nuqs/adapters/next/app"
import { siteFontClassName } from "./fonts"

import "./site.css"
import { SmoothScroll } from "@/components/smooth-scroll"
import { SiteFooter } from "@/features/footer"
import { FOOTER } from "@/features/footer/data/footer-links"
import { SiteHeader } from "@/features/navbar"
import { NAVIGATION } from "@/features/navbar/data/nav-links"
import { SITE } from "@/features/site/data/site"

// The public site has a single light design. The admin has its own root
// layout with light/dark support (Task 1.10), so next-themes is not used here.
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en-IE" className={siteFontClassName}>
      <body>
        <noscript>
          <style>{"[data-reveal]{visibility:visible!important}"}</style>
        </noscript>
        <NuqsAdapter>
          <SmoothScroll>
            <SiteHeader site={SITE} navigation={NAVIGATION} />
            {children}
            <SiteFooter site={SITE} footer={FOOTER} navigation={NAVIGATION} />
          </SmoothScroll>
        </NuqsAdapter>
      </body>
    </html>
  )
}

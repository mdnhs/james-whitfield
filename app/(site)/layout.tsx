import { NuqsAdapter } from "nuqs/adapters/next/app"
import { siteFontClassName } from "./fonts"

import "./site.css"
import { ScrollMotion } from "@/components/scroll-motion"
import { SmoothScroll } from "@/components/smooth-scroll"
import { SiteFooter } from "@/features/footer"
import { SiteHeader } from "@/features/navbar"

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
            <SiteHeader />
            {children}
            <SiteFooter />
            <ScrollMotion />
          </SmoothScroll>
        </NuqsAdapter>
      </body>
    </html>
  )
}

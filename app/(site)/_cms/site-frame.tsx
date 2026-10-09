import { io } from "next/cache"

import { SmoothScroll } from "@/components/smooth-scroll"
import { SiteFooter } from "@/features/footer"
import { SiteHeader } from "@/features/navbar"
import { themeCss } from "@/lib/content/theme"
import { PreviewBar } from "@/components/preview-bar"
import { isPreviewing } from "@/server/modules/content/preview"
import { getSetting } from "@/server/modules/content/queries"

// Site chrome from the globals (docs/brief.md §5.5a). io() suspends during
// prerender, so the build never reaches the database; at request time the
// settings come from the tag cache.
export async function SiteFrame({ children }: { children: React.ReactNode }) {
  await io()
  const [site, navigation, footer, theme, preview] = await Promise.all([
    getSetting("site"),
    getSetting("navigation"),
    getSetting("footer"),
    getSetting("theme"),
    isPreviewing(),
  ])
  const css = themeCss(theme.site)
  return (
    <>
      {css && <style>{css}</style>}
      <SmoothScroll>
        <SiteHeader site={site} navigation={navigation} />
        {children}
        <SiteFooter site={site} footer={footer} navigation={navigation} />
      </SmoothScroll>
      {preview ? <PreviewBar /> : null}
    </>
  )
}

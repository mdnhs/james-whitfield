import { io } from "next/cache"

import { SmoothScroll } from "@/components/smooth-scroll"
import { PreviewBar } from "@/components/preview-bar"
import { TrackingBootstrap } from "@/components/tracking/tracking-bootstrap"
import { ConsentBanner } from "@/features/consent/components/consent-banner"
import { CustomScripts } from "@/features/tracking/components/custom-scripts"
import { ClickTracker } from "@/features/tracking/components/click-tracker"
import { MarketingScripts } from "@/features/tracking/components/marketing-scripts"
import { RouteTracker } from "@/features/tracking/components/route-tracker"
import { SiteFooter } from "@/features/footer"
import { SiteHeader } from "@/features/navbar"
import { themeCss } from "@/lib/content/theme"
import { bootstrapScript } from "@/lib/tracking/bootstrap"
import { trackingFrame } from "@/lib/tracking/frame"
import { getEnv } from "@/server/env"
import { isPreviewing } from "@/server/modules/content/preview"
import { getSetting } from "@/server/modules/content/queries"
import { getPublicTracking } from "@/server/modules/tracking/public"

// Site chrome from the globals (docs/brief.md §5.5a). io() suspends during
// prerender, so the build never reaches the database; at request time the
// settings come from the tag cache. No cookies() here (Ruling R2): consent is
// read in the browser by the bootstrap.
export async function SiteFrame({ children }: { children: React.ReactNode }) {
  await io()
  const [site, navigation, footer, theme, preview, consent, scripts, tracking] =
    await Promise.all([
      getSetting("site"),
      getSetting("navigation"),
      getSetting("footer"),
      getSetting("theme"),
      isPreviewing(),
      getSetting("consent"),
      getSetting("scripts"),
      getPublicTracking(),
    ])
  const frame = trackingFrame({
    consent,
    scripts,
    tracking,
    preview,
    scriptsDisabled: getEnv().DISABLE_CUSTOM_SCRIPTS,
  })
  const css = themeCss(theme.site)
  return (
    <>
      {frame.active ? (
        <TrackingBootstrap script={bootstrapScript(frame)} />
      ) : null}
      {css && <style>{css}</style>}
      {frame.scripts.length ? <CustomScripts snippets={frame.scripts} /> : null}
      {frame.active ? (
        <>
          <RouteTracker />
          <ClickTracker />
          <MarketingScripts pixelId={frame.pixelId} />
        </>
      ) : null}
      <SmoothScroll>
        <SiteHeader site={site} navigation={navigation} />
        {children}
        <SiteFooter
          site={site}
          footer={footer}
          navigation={navigation}
          cookieSettings={frame.active ? consent.settingsLink : null}
        />
      </SmoothScroll>
      {frame.active ? (
        <ConsentBanner
          policy={frame.policy}
          copy={{
            title: consent.title,
            body: consent.body,
            accept: consent.accept,
            reject: consent.reject,
            customise: consent.customise,
            save: consent.save,
            policyLabel: consent.policyLabel,
            policyHref: consent.policyHref,
            categories: consent.categories,
          }}
        />
      ) : null}
      {preview ? <PreviewBar /> : null}
    </>
  )
}

import { io } from "next/cache"

import { SmoothScroll } from "@/components/smooth-scroll"
import { PreviewBar } from "@/components/preview-bar"
import { TrackingBootstrap } from "@/components/tracking/tracking-bootstrap"
import { ChatLauncher } from "@/features/chat/chat-launcher"
import { ConsentBanner } from "@/features/consent/components/consent-banner"
import { CustomScripts } from "@/features/tracking/components/custom-scripts"
import { ClickTracker } from "@/features/tracking/components/click-tracker"
import { MarketingScripts } from "@/features/tracking/components/marketing-scripts"
import { RouteTracker } from "@/features/tracking/components/route-tracker"
import { SiteFooter } from "@/features/footer"
import { SiteHeader, StickyCta } from "@/features/navbar"
import { siteThemeCss } from "@/lib/theme/css"
import { bootstrapScript } from "@/lib/tracking/bootstrap"
import { trackingFrame } from "@/lib/tracking/frame"
import { getEnv } from "@/server/env"
import { isPreviewing } from "@/server/modules/content/preview"
import {
  getChatLauncher,
  getSetting,
  getThemeConfig,
} from "@/server/modules/content/queries"
import { getBrandLogo } from "@/server/modules/theme/brand"
import { getPublicTracking } from "@/server/modules/tracking/public"

// Site chrome from the globals (docs/brief.md §5.5a). io() suspends during
// prerender, so the build never reaches the database; at request time the
// settings come from the tag cache. No cookies() here (Ruling R2): consent is
// read in the browser by the bootstrap.
export async function SiteFrame({ children }: { children: React.ReactNode }) {
  await io()
  const preview = await isPreviewing()
  const [
    site,
    navigation,
    footer,
    contact,
    microcopy,
    theme,
    consent,
    scripts,
    tracking,
    chat,
  ] = await Promise.all([
    getSetting("site"),
    getSetting("navigation"),
    getSetting("footer"),
    getSetting("contact"),
    getSetting("microcopy"),
    getThemeConfig(preview),
    getSetting("consent"),
    getSetting("scripts"),
    getPublicTracking(),
    getChatLauncher(),
  ])
  const logo = await getBrandLogo(site)
  const frame = trackingFrame({
    consent,
    scripts,
    tracking,
    preview,
    scriptsDisabled: getEnv().DISABLE_CUSTOM_SCRIPTS,
  })
  // R4: "" for the default theme, so the page is byte-identical to today.
  const css = siteThemeCss(theme.site)
  return (
    <>
      {frame.active ? (
        <TrackingBootstrap script={bootstrapScript(frame)} />
      ) : null}
      {css ? <style id="theme-tokens">{css}</style> : null}
      {frame.scripts.length ? <CustomScripts snippets={frame.scripts} /> : null}
      {frame.active ? (
        <>
          <RouteTracker />
          <ClickTracker />
          <MarketingScripts pixelId={frame.pixelId} />
        </>
      ) : null}
      <SmoothScroll>
        <SiteHeader site={site} navigation={navigation} logo={logo} />
        {children}
        <SiteFooter
          site={site}
          logo={logo}
          footer={footer}
          contact={contact}
          navigation={navigation}
          cookieSettings={frame.active ? consent.settingsLink : null}
        />
      </SmoothScroll>
      <StickyCta
        cta={navigation.cta}
        phone={contact.phone}
        callLabel={microcopy.callLabel}
      />
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
      {chat.enabled && !preview ? (
        <ChatLauncher botName={chat.botName} welcome={chat.welcome} />
      ) : null}
      {preview ? <PreviewBar /> : null}
    </>
  )
}

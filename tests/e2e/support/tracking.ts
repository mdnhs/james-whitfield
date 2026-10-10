import {
  request as playwrightRequest,
  type BrowserContext,
  type Page,
} from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"
import { api } from "./api"
import { STORAGE } from "./storage"

const VENDORS =
  /^https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net|[\w.-]*google-analytics\.com|www\.facebook\.com)\//

// Every vendor request is answered locally with an empty script and recorded.
export async function stubVendors(context: BrowserContext) {
  const hits: string[] = []
  await context.route(VENDORS, (route) => {
    hits.push(route.request().url())
    return route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: "",
    })
  })
  return hits
}

const COPY = {
  enabled: true,
  title: "E2E cookie banner",
  body: "E2E banner body.",
  accept: "Accept all",
  reject: "Reject all",
  customise: "Customise",
  save: "Save choices",
  settingsLink: "Cookie settings",
  policyLabel: "Privacy policy",
  policyHref: "/privacy",
  categories: { necessary: "N", analytics: "A", marketing: "M" },
  reconsentMonths: 6,
  version: 1,
}

// Switches GTM, the Pixel and the banner on through the owner's API.
export async function enableTracking() {
  const req = await playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    storageState: STORAGE.owner,
  })
  const tracking = await api<{ version: number }>(req, "GET", "/tracking")
  await api(req, "PUT", "/tracking", {
    version: tracking.version,
    value: {
      gtmId: "GTM-E2ETEST",
      ga4Id: "G-E2ETEST",
      metaPixelId: "1234567890",
      testEventCode: "",
      enabled: { gtm: true, ga4: true, meta: true, capi: false },
    },
  })
  const consent = await api<{ version: number }>(req, "GET", "/globals/consent")
  await api(req, "PUT", "/globals/consent", {
    version: consent.version,
    value: COPY,
  })
  await req.dispose()
}

export async function consentCookie(context: BrowserContext) {
  const cookie = (await context.cookies()).find((c) => c.name === "mk_consent")
  return cookie ? JSON.parse(decodeURIComponent(cookie.value)) : null
}

export const dataLayer = (page: Page) =>
  page.evaluate(() =>
    JSON.stringify((window as never as { dataLayer: unknown[] }).dataLayer)
  )

import { request as playwrightRequest, type Page } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"
import { api } from "./api"
import { STORAGE } from "./storage"

export async function ownerApi() {
  return playwrightRequest.newContext({
    baseURL: E2E_ORIGIN,
    storageState: STORAGE.owner,
  })
}

// Back to Teal Sage / Evergreen, published (R17).
export async function resetTheme() {
  const req = await ownerApi()
  let doc = await api<{ version: number }>(req, "GET", "/theme")
  doc = await api(req, "POST", "/theme/reset", {
    version: doc.version,
    preset: "teal-sage",
    scope: "site",
  })
  doc = await api(req, "POST", "/theme/reset", {
    version: doc.version,
    preset: "evergreen",
    scope: "admin",
  })
  await api(req, "POST", "/theme/publish", { version: doc.version })
  await req.dispose()
}

export const cssVar = (page: Page, name: string) =>
  page.evaluate(
    (n) =>
      getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
    name
  )

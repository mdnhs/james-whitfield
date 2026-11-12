import { describe, expect, it } from "vitest"

import { COLLECTION_NAMES } from "@/lib/content/collections"

import {
  adminHrefForPage,
  backLinkForPage,
  COLLECTION_HOME,
  isWebsiteKey,
  websiteHref,
} from "./website"

describe("website registry", () => {
  it("sends system pages to their Website screen, others to the builder", () => {
    expect(adminHrefForPage({ id: "x", systemKey: "about" })).toBe(
      "/admin/website/about"
    )
    expect(adminHrefForPage({ id: "x", systemKey: null })).toBe(
      "/admin/pages/x"
    )
  })

  it("builds hrefs and recognises keys", () => {
    expect(websiteHref("how-it-works")).toBe("/admin/website/how-it-works")
    expect(isWebsiteKey("home")).toBe(true)
    expect(isWebsiteKey("legal")).toBe(false)
  })

  it("homes every collection", () => {
    expect(COLLECTION_HOME.faqs).toBe("home")
    for (const name of COLLECTION_NAMES)
      expect(isWebsiteKey(COLLECTION_HOME[name])).toBe(true)
  })

  it("picks the back link by page kind", () => {
    expect(backLinkForPage({ systemKey: "about" }).href).toBe(
      "/admin/website/about"
    )
    expect(backLinkForPage({ systemKey: null, serviceId: "s" }).href).toBe(
      "/admin/website/services"
    )
    // An unlinked /services/* page is listed with the other pages.
    expect(backLinkForPage({ systemKey: null, serviceId: null }).href).toBe(
      "/admin/website/legal"
    )
  })
})

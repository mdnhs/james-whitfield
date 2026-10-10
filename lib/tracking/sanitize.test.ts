import { describe, expect, it } from "vitest"

import {
  META_ROUTES,
  metaAllowed,
  pageTitle,
  sanitizePath,
  sanitizeUrl,
} from "./sanitize"

const SITE = "https://magdakennedy.ie"

describe("sanitizeUrl (brief §12.1)", () => {
  it.each([
    ["/contact?topic=anxiety-stress", `${SITE}/contact`],
    ["/contact#form", `${SITE}/contact`],
    ["/insights/hypnosis-for-panic-attacks", `${SITE}/insights`],
    ["/insights/hypnosis-for-panic-attacks/", `${SITE}/insights`],
    ["/insights?q=anxiety&category=sleep", `${SITE}/insights`],
    ["/newsletter/unsubscribe?token=abc.def", `${SITE}/newsletter`],
    ["/newsletter/confirmed", `${SITE}/newsletter`],
    ["/", `${SITE}/`],
    [`${SITE}/about?utm_source=x`, `${SITE}/about`],
    [
      "https://www.google.com/search?q=hypnotherapy+anxiety",
      "https://www.google.com/search",
    ],
  ])("%s → %s", (input, expected) => {
    expect(sanitizeUrl(input, SITE)).toBe(expected)
  })

  it("returns an empty string for something that is not a URL", () => {
    expect(sanitizeUrl("http://[::1", SITE)).toBe("")
    expect(sanitizeUrl("", SITE)).toBe("")
  })

  it("collapses paths without a base too", () => {
    expect(sanitizePath("/insights/some-slug")).toBe("/insights")
    expect(sanitizePath("/insights")).toBe("/insights")
    expect(sanitizePath("/services")).toBe("/services")
  })
})

describe("pageTitle", () => {
  it("replaces titles of collapsed paths", () => {
    expect(
      pageTitle("/insights/hypnosis-for-panic", "Hypnosis for panic | MK")
    ).toBe("Insights")
    expect(pageTitle("/newsletter/unsubscribe", "Unsubscribe | MK")).toBe(
      "Newsletter"
    )
    expect(pageTitle("/about", "About | MK")).toBe("About | MK")
  })
})

describe("metaAllowed (Ruling R7)", () => {
  const at = (pathname: string, search = "", hash = "") => ({
    pathname,
    search,
    hash,
  })
  it.each(META_ROUTES)("allows %s with a clean URL", (path) => {
    expect(metaAllowed(at(path))).toBe(true)
  })
  it("refuses articles, newsletter pages and anything with a query or hash", () => {
    expect(metaAllowed(at("/insights/hypnosis-for-panic"))).toBe(false)
    expect(metaAllowed(at("/newsletter/unsubscribe", "?token=a"))).toBe(false)
    expect(metaAllowed(at("/contact", "?topic=anxiety-stress"))).toBe(false)
    expect(metaAllowed(at("/contact", "", "#form"))).toBe(false)
    expect(metaAllowed(at("/privacy"))).toBe(false)
  })
})

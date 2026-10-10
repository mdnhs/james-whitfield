import { describe, expect, it } from "vitest"

import {
  META_ROUTES,
  metaAllowed,
  pixelAllowed,
  metaSourceUrl,
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

  it.each([
    "/insights%2Fslug",
    "/insights%2fslug?x=1",
    "/Insights/Slug",
    "/INSIGHTS/slug",
    "/insights%252Fslug",
    "/insights\\slug",
    "/%69nsights/slug",
  ])(
    "collapses the encoded or cased variant %s like the canonical form",
    (input) => {
      expect(sanitizeUrl(input, SITE)).toBe(`${SITE}/insights`)
      expect(sanitizePath(input.split("?")[0]!)).toBe("/insights")
    }
  )
  it("collapses repeated slashes in a path", () => {
    expect(sanitizePath("//insights//slug")).toBe("/insights")
    expect(sanitizeUrl("https://site.ie//insights//slug")).toBe(
      "https://site.ie/insights"
    )
  })
  it("collapses newsletter variants and titles", () => {
    expect(sanitizeUrl("/Newsletter%2Funsubscribe", SITE)).toBe(
      `${SITE}/newsletter`
    )
    expect(pageTitle("/Insights%2Fslug", "Secret")).toBe("Insights")
    expect(pageTitle("/NEWSLETTER/x", "Secret")).toBe("Newsletter")
  })
  it("returns a safe value for protocol-relative and script URLs", () => {
    for (const bad of [
      "//evil.example/insights/x",
      "//host",
      "\\\\host",
      "javascript:alert(1)",
      "data:text/html,x",
      "JavaScript:alert(1)",
    ]) {
      expect(sanitizeUrl(bad, SITE)).toBe("")
      expect(sanitizeUrl(bad)).toBe("")
    }
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

describe("metaSourceUrl (CAPI, Ruling R7)", () => {
  it.each([
    ["/contact?topic=anxiety-stress#form", `${SITE}/contact`],
    ["/about", `${SITE}/about`],
    ["/insights/hypnosis-for-panic", `${SITE}/insights`],
    ["/hypnotherapy-for-anxiety", `${SITE}/`],
    ["/services/anxiety", `${SITE}/`],
    ["/Contact", `${SITE}/`],
    ["//evil.example/contact", ""],
  ])("%s → %s", (href, expected) => {
    expect(metaSourceUrl(href, SITE)).toBe(expected)
  })
})

describe("pixelAllowed (referrer must be neutral too)", () => {
  const here = {
    href: `${SITE}/contact`,
    pathname: "/contact",
    search: "",
    hash: "",
  }
  it.each([
    [`${SITE}/insights/hypnosis-for-panic`, false],
    [`${SITE}/contact?topic=y`, false],
    [`${SITE}/landing-page-slug`, false],
    ["not a url", false],
    ["https://www.google.com/search?q=x", true],
    ["", true],
    [`${SITE}/insights`, true],
    [`${SITE}/`, true],
  ])("referrer %s gives %s", (referrer, expected) => {
    expect(pixelAllowed(here, referrer)).toBe(expected)
  })
  it("still requires the current URL to pass metaAllowed", () => {
    expect(
      pixelAllowed({ ...here, href: `${SITE}/contact?x=1`, search: "?x=1" }, "")
    ).toBe(false)
  })
})

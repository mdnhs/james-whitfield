// lib/content/globals.test.ts
import { describe, expect, it, vi } from "vitest"

import { resolveSiteTokens, SITE_DEFAULT } from "@/lib/theme/site"

import { GLOBALS, parseGlobal, type GlobalKey } from "./globals"

describe("globals", () => {
  it("every key parses an empty document to safe defaults", () => {
    for (const key of Object.keys(GLOBALS) as (keyof typeof GLOBALS)[]) {
      expect(() => parseGlobal(key, undefined), key).not.toThrow()
    }
    expect(parseGlobal("navigation", undefined)).toEqual({
      links: [],
      cta: { label: "", href: "" },
    })
  })
  it("theme parses the Phase 3 hex shape to today's palette (R9)", () => {
    const legacy = { site: { brand: "#336060", cream: "#faf6f0" }, admin: {} }
    const parsed = parseGlobal("theme", legacy)
    // Unknown keys are stripped; brand normalises to the base brand, which
    // the resolver treats as identity.
    expect(parsed.site.tokens).toEqual({})
    expect(resolveSiteTokens(parsed.site)).toEqual(SITE_DEFAULT)
  })
  it("rejects a malformed E.164 number and a title template without %s", () => {
    expect(() => GLOBALS.contact.parse({ phone: { e164: "01 234" } })).toThrow()
    expect(() => GLOBALS.seo.parse({ titleTemplate: "Magda" })).toThrow()
  })
  it("takes https-only urls for social and sameAs", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://x.ie",
      "data:text/html,x",
    ]) {
      expect(
        () => GLOBALS.site.parse({ social: [{ label: "L", url }] }),
        url
      ).toThrow()
      expect(
        () => GLOBALS.seo.parse({ business: { sameAs: [url] } }),
        url
      ).toThrow()
    }
    expect(() =>
      GLOBALS.site.parse({ social: [{ label: "L", url: "https://x.ie/a" }] })
    ).not.toThrow()
  })
})

describe("parseGlobal fallbacks", () => {
  it.each(Object.keys(GLOBALS) as GlobalKey[])(
    "%s has complete defaults",
    (key) => {
      expect(GLOBALS[key].safeParse({}).success).toBe(true)
    }
  )
  // One hand-edited row must not take the whole site down (P3 carry).
  it("falls back to the defaults for an invalid stored value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(parseGlobal("navigation", { links: "nope" })).toEqual(
      GLOBALS.navigation.parse({})
    )
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

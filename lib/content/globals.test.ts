// lib/content/globals.test.ts
import { describe, expect, it, vi } from "vitest"

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
  it("theme accepts hex colours only (it is written into a <style> tag)", () => {
    expect(() =>
      GLOBALS.theme.parse({ site: { brand: "#336060" } })
    ).not.toThrow()
    expect(() => GLOBALS.theme.parse({ site: { brand: "red" } })).toThrow()
    expect(() =>
      GLOBALS.theme.parse({ site: { brand: "#000000;}</style>" } })
    ).toThrow()
  })
  it("rejects a malformed E.164 number and a title template without %s", () => {
    expect(() => GLOBALS.contact.parse({ phone: { e164: "01 234" } })).toThrow()
    expect(() => GLOBALS.seo.parse({ titleTemplate: "Magda" })).toThrow()
  })
  it("takes https-only urls for social and sameAs, hex-only admin theme", () => {
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
    expect(() => GLOBALS.theme.parse({ admin: { a: "red" } })).toThrow()
    expect(() => GLOBALS.theme.parse({ admin: { a: "#aabbcc" } })).not.toThrow()
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

// lib/content/globals.test.ts
import { describe, expect, it } from "vitest"

import { GLOBALS, parseGlobal } from "./globals"

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
      parseGlobal("theme", { site: { brand: "#336060" } })
    ).not.toThrow()
    expect(() => parseGlobal("theme", { site: { brand: "red" } })).toThrow()
    expect(() =>
      parseGlobal("theme", { site: { brand: "#000000;}</style>" } })
    ).toThrow()
  })
  it("rejects a malformed E.164 number and a title template without %s", () => {
    expect(() =>
      parseGlobal("contact", { phone: { e164: "01 234" } })
    ).toThrow()
    expect(() => parseGlobal("seo", { titleTemplate: "Magda" })).toThrow()
  })
})

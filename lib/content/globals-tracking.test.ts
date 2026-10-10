import { describe, expect, it } from "vitest"

import { ConsentGlobal, ScriptsGlobal, TrackingGlobal } from "./globals"

describe("tracking global", () => {
  it("defaults to everything off", () => {
    expect(TrackingGlobal.parse({})).toEqual({
      gtmId: "",
      ga4Id: "",
      metaPixelId: "",
      capiTokenEncrypted: null,
      testEventCode: "",
      enabled: { gtm: false, ga4: false, meta: false, capi: false },
      enhancedMatching: {
        enabled: false,
        acknowledgedAt: null,
        acknowledgedBy: null,
      },
    })
  })
  it("rejects malformed IDs with a readable message", () => {
    const r = TrackingGlobal.safeParse({
      gtmId: 'GTM-ABC";alert(1)//',
      ga4Id: "UA-1-1",
      metaPixelId: "12",
    })
    expect(r.success).toBe(false)
    const paths = r.error!.issues.map((i) => i.path.join("."))
    expect(paths).toEqual(["gtmId", "ga4Id", "metaPixelId"])
    expect(r.error!.issues[0]!.message).toBe("Use the GTM-XXXXXXX format")
  })
})

describe("consent global (Ruling R13)", () => {
  it("re-prompts every 6 months by default, never less often", () => {
    expect(ConsentGlobal.parse({}).reconsentMonths).toBe(6)
    expect(ConsentGlobal.safeParse({ reconsentMonths: 12 }).success).toBe(false)
  })
  it("refuses to switch on a banner with missing labels", () => {
    const r = ConsentGlobal.safeParse({ enabled: true, title: "Cookies" })
    expect(r.success).toBe(false)
    expect(r.error!.issues.map((i) => i.path[0])).toEqual([
      "body",
      "accept",
      "reject",
      "customise",
      "save",
      "settingsLink",
    ])
    expect(ConsentGlobal.safeParse({ enabled: false }).success).toBe(true)
  })
})

describe("scripts global (brief §12.6)", () => {
  const base = {
    name: "Chat",
    placement: "body",
    category: "marketing",
    routes: [],
    enabled: true,
  }
  it("takes an inline snippet", () => {
    expect(
      ScriptsGlobal.safeParse({
        snippets: [{ ...base, src: "", inline: "console.log(1)" }],
      }).success
    ).toBe(true)
  })
  it("needs exactly one of src and inline", () => {
    const both = ScriptsGlobal.safeParse({
      snippets: [{ ...base, src: "https://x.example/a.js", inline: "1" }],
    })
    const neither = ScriptsGlobal.safeParse({
      snippets: [{ ...base, src: "", inline: "" }],
    })
    expect(both.success).toBe(false)
    expect(neither.success).toBe(false)
  })
  it("refuses http and hosts outside CUSTOM_SCRIPT_HOSTS (empty by default)", () => {
    for (const src of [
      "http://cdn.example.com/a.js",
      "https://cdn.example.com/a.js",
      "javascript:alert(1)",
    ]) {
      const r = ScriptsGlobal.safeParse({
        snippets: [{ ...base, src, inline: "" }],
      })
      expect(r.success).toBe(false)
      expect(r.error!.issues[0]!.path).toEqual(["snippets", 0, "src"])
    }
  })
  it("accepts route patterns and refuses anything else", () => {
    const ok = ScriptsGlobal.safeParse({
      snippets: [
        { ...base, src: "", inline: "1", routes: ["/", "/insights/*"] },
      ],
    })
    const bad = ScriptsGlobal.safeParse({
      snippets: [{ ...base, src: "", inline: "1", routes: ["insights"] }],
    })
    expect(ok.success).toBe(true)
    expect(bad.success).toBe(false)
  })
})

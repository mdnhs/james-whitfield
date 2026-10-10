import { describe, expect, it } from "vitest"

import { ConsentGlobal, ScriptsGlobal } from "@/lib/content/globals"

import { trackingFrame } from "./frame"

// Spread, not parse: a live banner needs every label (Task 2 refine), which
// this decision does not care about.
const consent = { ...ConsentGlobal.parse({ version: 3 }), enabled: true }
const none = ScriptsGlobal.parse({})
const tracking = { gtmId: "GTM-AB12", ga4Id: "G-XYZ", pixelId: null }
const snippet = (category: string, enabled = true) => ({
  name: "s",
  placement: "body",
  src: "",
  inline: "1",
  category,
  routes: [],
  enabled,
})
const base = {
  consent,
  scripts: none,
  tracking,
  preview: false,
  scriptsDisabled: false,
}

describe("trackingFrame (Ruling R3)", () => {
  it("is active with the banner on and something to consent to", () => {
    expect(trackingFrame(base)).toMatchObject({
      active: true,
      policy: { version: 3, months: 6 },
      gtmId: "GTM-AB12",
      ga4Id: "G-XYZ",
      pixelId: null,
    })
  })

  it("is inactive when the banner is off: nothing loads at all", () => {
    const frame = trackingFrame({
      ...base,
      consent: { ...consent, enabled: false },
    })
    expect(frame).toMatchObject({ active: false, gtmId: null, ga4Id: null })
  })

  it("is inactive with nothing to consent to", () => {
    const frame = trackingFrame({
      ...base,
      tracking: { gtmId: null, ga4Id: null, pixelId: null },
    })
    expect(frame.active).toBe(false)
  })

  it("never tracks or runs snippets in draft preview", () => {
    const frame = trackingFrame({
      ...base,
      preview: true,
      scripts: ScriptsGlobal.parse({ snippets: [snippet("necessary")] }),
    })
    expect(frame).toMatchObject({ active: false, gtmId: null, scripts: [] })
  })

  it("counts a consent-gated snippet as something to consent to", () => {
    const frame = trackingFrame({
      ...base,
      tracking: { gtmId: null, ga4Id: null, pixelId: null },
      scripts: ScriptsGlobal.parse({ snippets: [snippet("analytics")] }),
    })
    expect(frame.active).toBe(true)
    expect(frame.scripts).toHaveLength(1)
  })

  it("keeps necessary snippets without a banner, drops gated ones and disabled ones", () => {
    const frame = trackingFrame({
      ...base,
      consent: { ...consent, enabled: false },
      scripts: ScriptsGlobal.parse({
        snippets: [
          snippet("necessary"),
          snippet("marketing"),
          snippet("necessary", false),
        ],
      }),
    })
    expect(frame.scripts.map((s) => s.category)).toEqual(["necessary"])
  })

  it("honours the kill switch", () => {
    const frame = trackingFrame({
      ...base,
      scriptsDisabled: true,
      scripts: ScriptsGlobal.parse({ snippets: [snippet("necessary")] }),
    })
    expect(frame.scripts).toEqual([])
  })

  it("drops GA4 when there is no GTM to run it (Ruling R5)", () => {
    const frame = trackingFrame({
      ...base,
      tracking: { gtmId: null, ga4Id: "G-XYZ", pixelId: "1234567890" },
    })
    expect(frame).toMatchObject({ active: true, ga4Id: null })
  })
})

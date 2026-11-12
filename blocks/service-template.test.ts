// blocks/service-template.test.ts
import { describe, expect, it } from "vitest"

import { pageDocumentFor } from "./page"
import { BlockInstance } from "./registry"
import { serviceTemplate } from "./service-template"

const BAND = "00000000-0000-4000-8000-0000000000b1"
const IMAGE = "00000000-0000-4000-8000-0000000000a1"
const service = {
  slug: "anxiety",
  title: "Anxiety & stress",
  body: "Calm, practical hypnotherapy for racing thoughts and tight shoulders.",
}

describe("serviceTemplate", () => {
  const doc = serviceTemplate(service, BAND, IMAGE)

  it("lays out the seven fixed sections in order", () => {
    expect(doc.blocks.map((b) => [b.type, b.anchor])).toEqual([
      ["hero.page", "home"],
      ["service.intro", "about"],
      ["service.benefits", "benefits"],
      ["journey", "sessions"],
      ["service.formats", "formats"],
      ["service.faq", "faq"],
      ["band", "book"],
    ])
    expect(doc.blocks.map((b) => b.chapter)).toEqual([
      null,
      "Overview",
      "Benefits",
      "Sessions",
      "Formats",
      "FAQ",
      null,
    ])
  })

  it("parses as a custom page", () => {
    const result = pageDocumentFor("custom").safeParse(doc)
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
  })

  it("titles the hero after the service and links it to booking", () => {
    const hero = doc.blocks[0]
    if (hero.type !== "hero.page") throw new Error("hero first")
    expect(hero.data.title).toBe(service.title)
    expect(hero.data.image.mediaId).toBe(IMAGE)
    expect(hero.data.cta).toEqual({
      label: "Book a discovery call",
      href: "/contact",
    })
    const band = doc.blocks[6]
    if (band.type !== "band") throw new Error("band last")
    expect(band.data.bandId).toBe(BAND)
  })

  it("keeps long service copy inside the field limits", () => {
    const long = serviceTemplate(
      { slug: "x", title: "T".repeat(90), body: "B".repeat(900) },
      BAND,
      IMAGE
    )
    expect(pageDocumentFor("custom").safeParse(long).success).toBe(true)
  })
})

describe("hero.page cta", () => {
  it("still parses a payload saved before the CTA existed", () => {
    const result = BlockInstance.safeParse({
      id: "about-home",
      type: "hero.page",
      anchor: "home",
      chapter: null,
      hidden: false,
      joinPrevious: false,
      data: {
        title: "About",
        subtitle: "S",
        image: { mediaId: IMAGE },
        focal: null,
        tint: 0.3,
        mirror: false,
      },
    })
    expect(result.success).toBe(true)
    if (result.success && result.data.type === "hero.page")
      expect(result.data.data.cta).toBeNull()
  })
})

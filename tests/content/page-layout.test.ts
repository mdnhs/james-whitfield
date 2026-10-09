import { describe, expect, it } from "vitest"

import { LEGAL_PAGES, SYSTEM_PAGES } from "@/server/db/seed/pages"

import { groupCards, pageChapters } from "@/lib/content/page-layout"

const blocksOf = (path: string) =>
  SYSTEM_PAGES.find((p) => p.path === path)!.specs.map((s, i) => ({
    ...s,
    id: String(i),
    hidden: false,
    joinPrevious: s.joinPrevious ?? false,
  }))

// The CHAPTERS arrays the pages had before Phase 3, verbatim.
const BEFORE: Record<string, [string, string][]> = {
  "/": [
    ["Welcome", "home"],
    ["About", "about"],
    ["Process", "how-it-works"],
    ["Stories", "testimonials"],
    ["Organisations", "enterprise"],
    ["Insights", "insights"],
    ["FAQ", "faq"],
    ["Contact", "contact"],
  ],
  "/about": [
    ["Welcome", "home"],
    ["Story", "story"],
    ["Approach", "approach"],
    ["Credentials", "credentials"],
    ["Stories", "testimonials"],
    ["Next step", "next-step"],
    ["Contact", "contact"],
  ],
  "/services": [
    ["Welcome", "home"],
    ["Services", "services"],
    ["Formats", "formats"],
    ["Organisations", "enterprise"],
    ["FAQ", "faq"],
    ["Contact", "contact"],
  ],
  "/how-it-works": [
    ["Welcome", "home"],
    ["Process", "how-it-works"],
    ["A session", "session"],
    ["Fit", "fit"],
    ["FAQ", "faq"],
    ["Next step", "next-step"],
    ["Contact", "contact"],
  ],
  "/insights": [
    ["Welcome", "home"],
    ["Articles", "articles"],
    ["Newsletter", "newsletter"],
    ["Contact", "contact"],
  ],
  "/contact": [
    ["Welcome", "home"],
    ["Get in touch", "get-in-touch"],
    ["Clinic", "clinic"],
    ["FAQ", "faq"],
  ],
}

describe("page layout", () => {
  it.each(Object.entries(BEFORE))(
    "derives the old rail for %s",
    (path, expected) => {
      const page = SYSTEM_PAGES.find((p) => p.path === path)!
      const chapters = pageChapters(
        blocksOf(path),
        page.contact ? "Contact" : null
      )
      expect(chapters.map((c) => [c.label, c.target])).toEqual(expected)
    }
  )

  it("groups joined blocks into one card and skips hidden ones", () => {
    const cards = groupCards(blocksOf("/"))
    expect(cards.map((card) => card.map((b) => b.anchor))).toEqual([
      ["home"],
      ["credibility", "about"],
      ["how-it-works"],
      ["testimonials"],
      ["enterprise"],
      ["insights"],
      ["faq"],
    ])
    const hidden = blocksOf("/").map((b) =>
      b.anchor === "enterprise" ? { ...b, hidden: true } : b
    )
    expect(
      groupCards(hidden)
        .flat()
        .map((b) => b.anchor)
    ).not.toContain("enterprise")
    expect(pageChapters(hidden, null).map((c) => c.target)).not.toContain(
      "enterprise"
    )
  })

  it("keeps legal pages out of the rail except Welcome and Contact", () => {
    const blocks = LEGAL_PAGES[0].specs.map((s, i) => ({
      ...s,
      id: String(i),
      hidden: false,
      joinPrevious: false,
    }))
    expect(pageChapters(blocks, "Contact").map((c) => c.target)).toEqual([
      "home",
      "contact",
    ])
  })
})

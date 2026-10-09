// blocks/page.test.ts
import { describe, expect, it } from "vitest"

import { pageDocumentFor } from "./page"

const MEDIA = { mediaId: "00000000-0000-4000-8000-000000000001" }
const hero = {
  id: "about-home",
  type: "hero.page",
  anchor: "home",
  chapter: "Welcome",
  hidden: false,
  joinPrevious: false,
  data: {
    title: "About",
    subtitle: "S",
    image: MEDIA,
    focal: null,
    tint: 0.32,
    mirror: false,
  },
}
const faq = (anchor: string, extra = {}) => ({
  id: `about-${anchor}`,
  type: "faq",
  anchor,
  chapter: null,
  hidden: false,
  joinPrevious: false,
  data: {
    variant: "page",
    title: "FAQ",
    subtitle: "S",
    selection: { mode: "all" },
    initiallyOpen: 0,
  },
  ...extra,
})
const messages = (
  kind: Parameters<typeof pageDocumentFor>[0],
  blocks: unknown[]
) => {
  const result = pageDocumentFor(kind).safeParse({ blocks })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe("page document rules", () => {
  it("accepts a well-formed page", () => {
    expect(messages("about", [hero, faq("faq")])).toEqual([])
  })
  it("rejects duplicate anchors", () => {
    expect(
      messages("about", [hero, faq("faq"), faq("faq", { id: "about-faq-2" })])
    ).toContain('Anchor "faq" is already used on this page')
  })
  it('reserves "home" for the hero, and gives every hero that anchor', () => {
    expect(messages("about", [faq("home")])).toContain(
      '"home" is reserved for the page hero'
    )
    expect(messages("about", [{ ...hero, anchor: "top" }])).toContain(
      'A hero\'s anchor is "home"'
    )
  })
  const grid = (anchor: string) => ({
    id: `services-${anchor}`,
    type: "services.grid",
    anchor,
    chapter: null,
    hidden: false,
    joinPrevious: false,
    data: {
      eyebrow: "E",
      title: "T",
      intro: "I",
      more: { label: "More", href: "#formats" },
    },
  })
  it("keeps heroes first and blocks on the pages they belong to", () => {
    expect(
      messages("about", [faq("faq"), { ...hero, anchor: "top" }])
    ).toContain("Page hero must be the first block")
    expect(messages("about", [hero, grid("services")])).toContain(
      "Services grid is not allowed on this page"
    )
  })
  it("caps per-type counts", () => {
    expect(messages("services", [hero, grid("a"), grid("b")])).toContain(
      "At most 1 Services grid per page"
    )
  })
  it("never lets the first block join a previous card", () => {
    expect(messages("about", [{ ...hero, joinPrevious: true }])).toContain(
      "The first block cannot join a previous card"
    )
  })
})

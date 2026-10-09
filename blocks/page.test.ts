// blocks/page.test.ts
import { describe, expect, it } from "vitest"

import { DraftDocument, kindOf, PageMetaPatch, pageDocumentFor } from "./page"

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

const heroBlock = (id: string) => ({
  id,
  type: "hero.page",
  anchor: "home",
  chapter: "Welcome",
  hidden: false,
  joinPrevious: false,
  data: {
    title: "T",
    subtitle: "S",
    image: { mediaId: "00000000-0000-4000-8000-000000000001" },
    focal: null,
    tint: 0.3,
    mirror: false,
  },
})

describe("page documents (Phase 4)", () => {
  it("rejects two blocks with the same id", () => {
    const badges = {
      ...heroBlock("dup-1"),
      type: "credibility",
      anchor: "trust",
      data: {
        badges: [1, 2, 3].map((n) => ({
          title: `B${n}`,
          subtitle: "S",
          icon: "shield",
        })),
      },
    }
    const result = pageDocumentFor("custom").safeParse({
      blocks: [heroBlock("dup-1"), badges],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((i) => i.path.join("."))).toContain(
      "blocks.1.id"
    )
  })
  it("lets a draft hold half-finished data but not unknown block types", () => {
    const draft = { blocks: [{ ...heroBlock("abcd"), data: { title: "" } }] }
    expect(DraftDocument.safeParse(draft).success).toBe(true)
    expect(
      DraftDocument.safeParse({ blocks: [{ ...heroBlock("abcd"), type: "x" }] })
        .success
    ).toBe(false)
  })
  it("maps system keys to page kinds", () => {
    expect(kindOf("about")).toBe("about")
    expect(kindOf(null)).toBe("custom")
    expect(kindOf("nope")).toBe("custom")
  })
  it("needs at least one change in a meta patch", () => {
    expect(PageMetaPatch.safeParse({}).success).toBe(false)
    expect(PageMetaPatch.safeParse({ seo: { noindex: true } }).success).toBe(
      true
    )
  })
})

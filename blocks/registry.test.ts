// blocks/registry.test.ts
import { describe, expect, it } from "vitest"

import { Href, StatValue, Anchor } from "./fields"
import { aboutApproach } from "./about"
import { credibility } from "./home"
import { BLOCKS, BlockInstance } from "./registry"
import { RichTextDoc } from "./rich-text"

describe("block registry", () => {
  it("declares the 22 section types once each", () => {
    const types = BLOCKS.map((block) => block.type)
    expect(types).toHaveLength(22)
    expect(new Set(types).size).toBe(22)
  })

  it("rejects empty data for every block that has required fields", () => {
    for (const block of BLOCKS) {
      expect(block.schema.safeParse({}).success, block.type).toBe(false)
    }
  })

  it("holds item counts to what the layout can carry", () => {
    const badge = { title: "Badge", subtitle: "Sub", icon: "shield" }
    const ok = (n: number) =>
      credibility.schema.safeParse({ badges: Array(n).fill(badge) }).success
    expect([ok(2), ok(3), ok(5), ok(6)]).toEqual([false, true, true, false])

    const principle = { icon: "evidence", title: "T", body: "B" }
    const three = (n: number) =>
      aboutApproach.schema.safeParse({
        eyebrow: "E",
        title: "T",
        subtitle: "S",
        principles: Array(n).fill(principle),
      }).success
    expect([three(2), three(3), three(4)]).toEqual([false, true, false])
  })

  it("parses a minimal valid instance of every block type", () => {
    const media = { mediaId: "00000000-0000-4000-8000-000000000001" }
    const link = { label: "L", href: "/x" }
    const stat = { value: { kind: "text", text: "T" }, label: "L" }
    const sel = { mode: "all" }
    const uuid = media.mediaId
    const data: Record<string, unknown> = {
      "hero.home": {
        eyebrow: "E",
        headline: { lead: "a", muted: "b", tail: "c" },
        description: "D",
        primaryCta: link,
        secondaryCta: link,
        members: {
          count: stat.value,
          label: "L",
          avatars: [media, media, media],
        },
      },
      "hero.page": {
        title: "T",
        subtitle: "S",
        image: media,
        focal: null,
        tint: 0.3,
        mirror: false,
      },
      credibility: {
        badges: Array(3).fill({ title: "T", subtitle: "S", icon: "shield" }),
      },
      "about.intro": {
        eyebrow: "E",
        headline: "H",
        quote: "Q",
        paragraphs: ["P"],
        stats: [stat, stat],
        cta: link,
      },
      process: {
        variant: "home",
        tag: "",
        title: "T",
        subtitle: "S",
        cta: link,
      },
      testimonials: {
        variant: "home",
        eyebrow: "E",
        title: "T",
        selection: sel,
      },
      band: { bandId: uuid, tint: null },
      "insights.latest": {
        title: "T",
        subtitle: "S",
        cta: link,
        count: 3,
        selection: sel,
      },
      faq: {
        variant: "home",
        title: "T",
        subtitle: "S",
        selection: sel,
        initiallyOpen: null,
      },
      "about.story": {
        eyebrow: "E",
        title: "T",
        paragraphs: ["P"],
        quote: "Q",
        badge: stat,
        role: "R",
        photo: media,
      },
      "about.stats": { stats: [stat, stat, stat] },
      "about.approach": {
        eyebrow: "E",
        title: "T",
        subtitle: "S",
        principles: Array(3).fill({ icon: "evidence", title: "T", body: "B" }),
      },
      "about.credentials": {
        eyebrow: "E",
        title: "T",
        subtitle: "S",
        cta: link,
        items: Array(3).fill({
          year: "2020",
          title: "T",
          issuer: "I",
          url: null,
        }),
      },
      "services.grid": { eyebrow: "E", title: "T", intro: "I", more: link },
      "services.plans": {
        eyebrow: "E",
        title: "T",
        subtitle: "S",
        featuredTag: "F",
      },
      "session.timeline": {
        eyebrow: "E",
        title: "T",
        subtitle: "S",
        beats: Array(3).fill({ time: "1m", title: "T", body: "B" }),
      },
      fit: {
        eyebrow: "E",
        title: "T",
        subtitle: "S",
        good: { heading: "H", items: ["a", "b"] },
        poor: { heading: "H", items: ["a", "b"] },
      },
      "insights.browser": { heading: "H", pageSize: 6 },
      newsletter: { override: null },
      "contact.details": { eyebrow: "E", title: "T", subtitle: "S" },
      "contact.clinic": {
        eyebrow: "E",
        title: "T",
        subtitle: "S",
        photo: media,
      },
      richtext: { doc: { type: "doc", content: [] }, width: "narrow" },
    }
    expect(Object.keys(data).sort()).toEqual(BLOCKS.map((b) => b.type).sort())
    for (const block of BLOCKS) {
      const result = BlockInstance.safeParse({
        id: "block-1",
        type: block.type,
        anchor: "a",
        chapter: null,
        hidden: false,
        joinPrevious: false,
        data: data[block.type],
      })
      expect(
        result.success,
        `${block.type}: ${JSON.stringify(result.error?.issues)}`
      ).toBe(true)
    }
  })

  it("only accepts safe hrefs", () => {
    for (const href of [
      "/contact",
      "/contact?topic=sleep-rest",
      "#faq",
      "https://x.ie",
      "mailto:a@b.ie",
      "tel:+353",
    ]) {
      expect(Href.safeParse(href).success, href).toBe(true)
    }
    for (const href of [
      "javascript:alert(1)",
      "//evil.example",
      "http://x.ie",
      "",
    ]) {
      expect(Href.safeParse(href).success, href).toBe(false)
    }
  })

  it("accepts kebab-case anchors only", () => {
    expect(Anchor.safeParse("how-it-works").success).toBe(true)
    expect(Anchor.safeParse("How It Works").success).toBe(false)
    expect(Anchor.safeParse("-faq").success).toBe(false)
  })

  it("stores counters as numbers", () => {
    expect(
      StatValue.safeParse({
        kind: "count",
        value: 4.9,
        decimals: 1,
        prefix: "",
        suffix: "/5",
      }).success
    ).toBe(true)
    expect(StatValue.safeParse({ kind: "count", value: "10+" }).success).toBe(
      false
    )
  })

  it("validates TipTap documents", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Lead." }] },
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "H" }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Bold.", marks: [{ type: "bold" }] },
                    { type: "text", text: " Rest" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }
    expect(RichTextDoc.safeParse(doc).success).toBe(true)
    const h1 = {
      type: "doc",
      content: [{ type: "heading", attrs: { level: 1 } }],
    }
    expect(RichTextDoc.safeParse(h1).success).toBe(false)
  })

  it("discriminates instances by type", () => {
    const parsed = BlockInstance.safeParse({
      id: "home-faq",
      type: "faq",
      anchor: "faq",
      chapter: "FAQ",
      hidden: false,
      joinPrevious: false,
      data: {
        variant: "home",
        title: "FAQ",
        subtitle: "S",
        selection: { mode: "all" },
        initiallyOpen: 0,
      },
    })
    expect(parsed.success).toBe(true)
  })
})

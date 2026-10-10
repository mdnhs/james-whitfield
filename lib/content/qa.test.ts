import { describe, expect, it } from "vitest"

import { legalFinding, scanContent, strings } from "./qa"

const src = (label: string, value: unknown) => ({
  label,
  href: `/admin/${label}`,
  value,
})

describe("strings", () => {
  it("collects every string, however deep", () => {
    expect(
      strings({ a: "x", b: [{ c: "y" }, 3, null], d: { e: { f: "z" } } })
    ).toEqual(["x", "y", "z"])
  })
})

describe("scanContent (docs/brief.md §4.6)", () => {
  it("flags the rebrand leftovers, once per source", () => {
    const findings = scanContent([
      src("about", { text: "James works with… James again" }),
      src("contact", { email: "hello@jameswhitfield.ie" }),
      src("clean", { text: "Magda works with individuals." }),
    ])
    expect(findings.map((f) => [f.rule, f.label])).toEqual([
      ["rebrand", "about"],
      ["rebrand", "contact"],
    ])
  })

  it("flags placeholder contact lines and placeholder copy", () => {
    const findings = scanContent([
      src("footer", {
        contactLines: ["[email]", "[phone]", "[Dublin, Ireland]"],
      }),
      src("privacy", {
        doc: "This privacy policy is a placeholder and has not been reviewed.",
      }),
    ])
    expect(findings.map((f) => f.rule)).toEqual([
      "placeholder-contact",
      "placeholder-copy",
    ])
  })

  it("flags the online-reach contradiction only when both wordings exist", () => {
    expect(
      scanContent([
        src("contact", { note: "Online sessions available worldwide" }),
      ])
    ).toEqual([])
    const [finding] = scanContent([
      src("contact", { note: "Online sessions available worldwide via Zoom." }),
      src("footer", { note: "Online sessions available - Ireland, UK & USA." }),
    ])
    expect(finding).toMatchObject({
      rule: "online-reach",
      label: "contact, footer",
      href: "/admin/contact",
    })
  })

  it("never matches a bare word like 'his' or a lowercase name in a slug", () => {
    expect(
      scanContent([src("x", { text: "His practice", slug: "st-jamess" })])
    ).toEqual([])
  })

  it("flags James only as the practitioner, not as someone's own name", () => {
    expect(
      scanContent([src("t", { authorName: "James O'Brien", quote: "Calm." })])
    ).toEqual([])
    expect(
      scanContent([
        src("t1", { quote: "Working with James has been valuable." }),
        src("t2", { quote: "James helped me move on." }),
        src("t3", { text: "Meet James Whitfield." }),
      ]).map((f) => f.label)
    ).toEqual(["t1", "t2", "t3"])
  })
})

describe("legalFinding", () => {
  it("links to the page when it exists, else to the page list", () => {
    expect(
      legalFinding("/privacy", { id: "p1", title: "Privacy Policy" })
    ).toMatchObject({
      rule: "legal-unpublished",
      label: "Privacy Policy",
      href: "/admin/pages/p1",
    })
    expect(legalFinding("/terms", null)).toMatchObject({
      label: "/terms",
      href: "/admin/pages",
    })
  })
})

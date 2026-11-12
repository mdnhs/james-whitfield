import { describe, expect, it } from "vitest"

import { renderLlms, type LlmsEntry } from "./llms"

const entry = (over: Partial<LlmsEntry>): LlmsEntry => ({
  kind: "page",
  path: "/",
  title: "Home",
  description: "Welcome",
  noindex: false,
  ...over,
})

const input = (entries: LlmsEntry[]) => ({
  name: "Magda Kennedy",
  description: "Coaching for founders",
  origin: "https://example.com",
  entries,
})

describe("renderLlms", () => {
  it("starts with the site name and description", () => {
    const out = renderLlms(input([entry({})]))
    expect(out.startsWith("# Magda Kennedy\n\n> Coaching for founders\n")).toBe(
      true
    )
  })

  it("lists pages and articles once each with absolute urls", () => {
    const out = renderLlms(
      input([
        entry({}),
        entry({ path: "/about", title: "About", description: "Who I am" }),
        entry({
          kind: "article",
          path: "/insights/a",
          title: "A",
          description: "",
        }),
      ])
    )
    expect(out).toContain("## Pages\n\n- [Home](https://example.com): Welcome")
    expect(out).toContain("- [About](https://example.com/about): Who I am")
    expect(out).toContain(
      "## Articles\n\n- [A](https://example.com/insights/a)\n"
    )
    expect(out.match(/\[Home\]/g)).toHaveLength(1)
  })

  it("skips noindex entries and empty sections", () => {
    const out = renderLlms(
      input([entry({}), entry({ path: "/x", title: "Hidden", noindex: true })])
    )
    expect(out).not.toContain("Hidden")
    expect(out).not.toContain("## Articles")
  })
})

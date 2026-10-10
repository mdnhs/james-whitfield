import { readFile } from "node:fs/promises"
import path from "node:path"

import tailwind from "@tailwindcss/postcss"
import postcss from "postcss"
import { describe, expect, it } from "vitest"

import { siteSources } from "./site-sources"

const root = path.join(import.meta.dirname, "../..")

// docs/brief.md §10.3: these literals now live in site.css as tokens, so the
// theme engine (Phase 9) can override them at runtime.
const TOKENS: Record<string, string> = {
  "text-strong": "#0c0c0c",
  "text-muted": "#525252",
  "text-subtle": "#6e726d",
  line: "#dfe2d8",
  "line-soft": "#e7e9e0",
  "line-neutral": "#ececec",
  "line-faint": "#f2f2f2",
  "line-rule": "#d8dccf",
  "surface-soft": "#f8f9f5",
  "surface-warm": "#fcfaf7",
  "hero-base": "#0d120f",
  moss: "#315d44",
  spruce: "#002620",
}

describe("site colour tokens", () => {
  it("site.css defines every token with today's value", async () => {
    const from = path.join(root, "app/(site)/site.css")
    const { css } = await postcss([tailwind({ base: root })]).process(
      await readFile(from, "utf8"),
      { from }
    )
    for (const [name, hex] of Object.entries(TOKENS)) {
      expect(css).toContain(`--color-${name}: ${hex}`)
    }
  }, 60_000)

  it("no site component hardcodes a tokenised colour", async () => {
    const files = await siteSources()
    const offenders: string[] = []
    for (const file of files) {
      const source = (
        await readFile(path.join(root, file), "utf8")
      ).toLowerCase()
      for (const hex of Object.values(TOKENS)) {
        if (source.includes(hex)) offenders.push(`${file}: ${hex}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

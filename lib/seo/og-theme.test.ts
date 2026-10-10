import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { OG_DEFAULTS, ogColors } from "./og-theme"

describe("ogColors", () => {
  it("defaults to the site.css tokens", () => {
    const css = readFileSync(
      path.join(import.meta.dirname, "../../app/(site)/site.css"),
      "utf8"
    )
    expect(css).toContain(`--color-ink: ${OG_DEFAULTS.ink};`)
    expect(css).toContain(`--color-cream: ${OG_DEFAULTS.cream};`)
    expect(css).toContain(`--color-brand-mint: ${OG_DEFAULTS["brand-mint"]};`)
    expect(ogColors({})).toEqual({
      background: OG_DEFAULTS.ink,
      text: OG_DEFAULTS.cream,
      accent: OG_DEFAULTS["brand-mint"],
    })
  })
  it("follows the published theme", () => {
    expect(
      ogColors({ ink: "#111111", cream: "#eeeeee", "brand-mint": "#00ff99" })
    ).toEqual({ background: "#111111", text: "#eeeeee", accent: "#00ff99" })
  })
})

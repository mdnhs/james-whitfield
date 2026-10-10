import { describe, expect, it } from "vitest"

import { DEFAULT_THEME, ThemeConfig } from "@/lib/theme/schema"

import { ogColors } from "./og-theme"

describe("ogColors", () => {
  it("uses today's palette for the default theme", () => {
    expect(ogColors(DEFAULT_THEME.site)).toEqual({
      background: "#030303",
      text: "#faf6f0",
      accent: "#d6e8e4",
    })
  })
  it("follows a locked token", () => {
    const site = ThemeConfig.parse({
      site: { tokens: { ink: "#111111" } },
    }).site
    expect(ogColors(site).background).toBe("#111111")
  })
})

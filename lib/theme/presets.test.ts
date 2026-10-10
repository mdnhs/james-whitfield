// lib/theme/presets.test.ts
import { describe, expect, it } from "vitest"

import { buildAdminTokens, presetAdminColours } from "./admin"
import { checkTheme } from "./checks"
import { toHex } from "./color"
import { PRESET_IDS } from "./presets"
import { DEFAULT_THEME, ThemeConfig } from "./schema"
import { presetSiteTheme, resolveSiteTokens, SITE_DEFAULT } from "./site"

const hexes = (tokens: Record<string, Parameters<typeof toHex>[0]>) =>
  Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, toHex(v)]))

const presetConfig = (id: (typeof PRESET_IDS)[number]) =>
  ThemeConfig.parse({
    site: presetSiteTheme(id),
    admin: { ...DEFAULT_THEME.admin, ...presetAdminColours(id) },
  })

describe("presets", () => {
  it("Teal Sage resolves to exactly today's site palette", () => {
    expect(resolveSiteTokens(DEFAULT_THEME.site)).toEqual(SITE_DEFAULT)
    expect(hexes(SITE_DEFAULT).brand).toBe("#336060")
  })

  it.each(PRESET_IDS)("%s passes every contrast pair", (id) => {
    expect(checkTheme(presetConfig(id))).toEqual([])
  })

  it.each(PRESET_IDS)("%s snapshot", (id) => {
    const config = presetConfig(id)
    expect({
      site: hexes(resolveSiteTokens(config.site)),
      light: hexes(buildAdminTokens(config.admin, "light")),
      dark: hexes(buildAdminTokens(config.admin, "dark")),
    }).toMatchSnapshot()
  })

  it("a custom brand moves derived tokens but not neutrals or clay", () => {
    const site = { ...DEFAULT_THEME.site, brand: "oklch(0.47 0.09 250)" }
    const tokens = resolveSiteTokens(ThemeConfig.parse({ site }).site)
    expect(tokens.pine.h).not.toBe(SITE_DEFAULT.pine.h)
    expect(tokens["text-muted"]).toEqual(SITE_DEFAULT["text-muted"])
    expect(tokens.clay).toEqual(SITE_DEFAULT.clay)
  })

  it("a locked token wins over derivation", () => {
    const site = {
      ...DEFAULT_THEME.site,
      brand: "#2f5f8a",
      tokens: { pine: "#1e4f50" },
    }
    const tokens = resolveSiteTokens(ThemeConfig.parse({ site }).site)
    expect(toHex(tokens.pine)).toBe("#1e4f50")
  })

  it("custom admin primary gets an automatic foreground in both modes", () => {
    const admin = { ...DEFAULT_THEME.admin, primary: "#e0b000" }
    const parsed = ThemeConfig.parse({ admin }).admin
    for (const mode of ["light", "dark"] as const) {
      const t = buildAdminTokens(parsed, mode)
      expect(t["primary-foreground"]).toBeDefined()
    }
    expect(
      checkTheme(ThemeConfig.parse({ admin })).map((i) => i.text)
    ).not.toContain("primary-foreground")
  })

  it("tint 'none' greys the neutrals; 'primary' gives them its hue", () => {
    const base = ThemeConfig.parse({ admin: { primary: "#6a3f6b" } }).admin
    const none = buildAdminTokens({ ...base, tint: "none" }, "light")
    const tinted = buildAdminTokens({ ...base, tint: "primary" }, "light")
    expect(none.sidebar.c).toBe(0)
    expect(tinted.sidebar.h).toBeCloseTo(
      buildAdminTokens(base, "light").primary.h,
      0
    )
  })
})

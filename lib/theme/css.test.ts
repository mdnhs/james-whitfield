// lib/theme/css.test.ts
import { describe, expect, it } from "vitest"

import { adminThemeCss, liveDeclarations, siteThemeCss } from "./css"
import { DEFAULT_THEME, ThemeConfig } from "./schema"

const SAFE = /^[a-z0-9\-:;(){}.\[\]="\s]*$/i

describe("siteThemeCss", () => {
  it("emits nothing for the default theme (parity, R4)", () => {
    expect(siteThemeCss(DEFAULT_THEME.site)).toBe("")
  })

  it("emits only the tokens that changed, as :root overrides", () => {
    const site = ThemeConfig.parse({
      site: { tokens: { clay: "#a8553a" } },
    }).site
    expect(siteThemeCss(site)).toMatch(
      /^:root\{--color-clay:oklch\([\d.]+ [\d.]+ [\d.]+\)\}$/
    )
  })

  it("emits only numeric declarations", () => {
    const site = ThemeConfig.parse({ site: { brand: "#2f5f8a" } }).site
    const css = siteThemeCss(site)
    expect(css).toMatch(SAFE)
    expect(css).not.toContain("<")
    expect(css).not.toContain("NaN")
  })

  it("no NaN for black, white and greys", () => {
    for (const brand of ["#000000", "#ffffff", "#808080"]) {
      const css = siteThemeCss(ThemeConfig.parse({ site: { brand } }).site)
      expect(css).not.toContain("NaN")
      expect(css).toMatch(SAFE)
    }
  })
})

describe("adminThemeCss", () => {
  it("emits nothing for the Evergreen default", () => {
    expect(adminThemeCss(DEFAULT_THEME.admin)).toBe("")
  })

  it("scopes light and dark separately and adds the radius", () => {
    const admin = ThemeConfig.parse({
      admin: { primary: "#2f5f8a", radius: 0.5 },
    }).admin
    const css = adminThemeCss(admin)
    expect(css).toMatch(/^:root\[data-theme="admin"\]\{[^}]*--radius:0\.5rem/)
    expect(css).toContain(':root[data-theme="admin"].dark{')
    expect(css).toMatch(SAFE)
  })
})

describe("liveDeclarations", () => {
  it("lists every admin token and the radius", () => {
    const decls = liveDeclarations(DEFAULT_THEME.admin, "light")
    expect(decls).toContainEqual(["--radius", "0.75rem"])
    expect(decls.find(([n]) => n === "--primary")?.[1]).toMatch(/^oklch\(/)
  })
})

describe("serialiser safety", () => {
  const MALICIOUS = [
    "red;}</style><script>alert(1)</script>",
    "#336060;}</style><script>",
    "oklch(0.5 0.1 200);}",
    "var(--x)",
    "red",
  ]

  it.each(MALICIOUS)("rejects %s at Zod parse", (value) => {
    expect(ThemeConfig.safeParse({ site: { brand: value } }).success).toBe(
      false
    )
    expect(
      ThemeConfig.safeParse({ site: { tokens: { clay: value } } }).success
    ).toBe(false)
    expect(ThemeConfig.safeParse({ admin: { primary: value } }).success).toBe(
      false
    )
    expect(ThemeConfig.safeParse({ admin: { accent: value } }).success).toBe(
      false
    )
  })

  it("rejects unknown token names", () => {
    const parsed = ThemeConfig.safeParse({
      site: { tokens: { "x}</style>": "#000000" } },
    })
    expect(parsed.success).toBe(false)
  })
})

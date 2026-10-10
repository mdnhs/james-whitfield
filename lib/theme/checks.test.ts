// lib/theme/checks.test.ts
import { describe, expect, it } from "vitest"

import { contrast, parseColor } from "./color"
import { checkTheme, describeIssue, fixAll, fixIssue, rating } from "./checks"
import { DEFAULT_THEME, ThemeConfig } from "./schema"
import { resolveSiteTokens } from "./site"

const withSite = (site: object) =>
  ThemeConfig.parse({ site: { ...DEFAULT_THEME.site, ...site } })

describe("checkTheme", () => {
  it("the default theme has no issues", () => {
    expect(checkTheme(DEFAULT_THEME)).toEqual([])
  })

  it("finds a failing site pair and explains it in words", () => {
    const issues = checkTheme(withSite({ tokens: { "text-muted": "#cccccc" } }))
    const muted = issues.find(
      (i) => i.text === "text-muted" && i.surface === "cream"
    )!
    expect(muted).toMatchObject({ scope: "site", min: 4.5 })
    expect(describeIssue(muted)).toMatch(
      /^Muted text on Cream is \d\.\d{2}:1; it needs 4\.5:1 \(body text\)\.$/
    )
  })

  it("never rounds a failing ratio up to the threshold", () => {
    const issue = {
      scope: "site" as const,
      text: "clay",
      surface: "cream",
      ratio: 4.4999,
      min: 4.5 as const,
    }
    expect(describeIssue(issue)).toContain("4.49:1")
  })

  it("checks admin light and dark separately", () => {
    const config = ThemeConfig.parse({ admin: { primary: "#e8f0e8" } })
    const scopes = new Set(checkTheme(config).map((i) => i.scope))
    expect(scopes.has("admin-light")).toBe(true)
  })
})

describe("fix automatically", () => {
  it("fixes a site text token by locking a darker value", () => {
    const config = withSite({ tokens: { "text-muted": "#cccccc" } })
    const [issue] = checkTheme(config)
    const fixed = fixIssue(config, issue!)!
    const tokens = resolveSiteTokens(fixed.site)
    expect(contrast(tokens["text-muted"], tokens.cream)).toBeGreaterThanOrEqual(
      4.5
    )
  })

  it("moves the coloured side, not the page surface", () => {
    const config = withSite({ brand: "#7fb0b0" })
    const issue = checkTheme(config).find(
      (i) => i.text === "cream" && i.surface === "brand"
    )!
    const fixed = fixIssue(config, issue)!
    expect(fixed.site.brand).not.toBe(config.site.brand)
    expect(fixed.site.tokens.cream).toBeUndefined()
  })

  it("fixAll leaves no issues for a fixable theme", () => {
    const config = withSite({
      tokens: { "text-muted": "#cccccc", "text-strong": "#bbbbbb" },
    })
    expect(fixAll(config).remaining).toEqual([])
  })

  it("fixAll never leaves a theme with more failing pairs", () => {
    const configs = [
      withSite({ brand: "#000000" }),
      withSite({ brand: "#ffffff" }),
      withSite({ brand: "#000000", tokens: { "text-muted": "#dddddd" } }),
      ThemeConfig.parse({ admin: { primary: "#000000", accent: "#ffff00" } }),
      ThemeConfig.parse({ admin: { primary: "#ffffff" } }),
    ]
    for (const config of configs) {
      const before = checkTheme(config).length
      expect(checkTheme(fixAll(config).config).length).toBeLessThanOrEqual(
        before
      )
      expect(fixAll(config).remaining.length).toBeLessThanOrEqual(before)
    }
  })

  it("rates AAA, AA and fail", () => {
    expect(rating(7.1, 4.5)).toBe("AAA")
    expect(rating(4.6, 4.5)).toBe("AA")
    expect(rating(4.49, 4.5)).toBe("fail")
    expect(rating(4.6, 3)).toBe("AAA")
    expect(parseColor("#000000")).not.toBeNull()
  })
})

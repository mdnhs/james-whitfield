// lib/theme/checks.ts
import { buildAdminTokens } from "./admin"
import { contrast, formatOklch, nudge, parseColor, type Oklch } from "./color"
import type { ThemeConfigValue } from "./schema"
import { resolveSiteTokens } from "./site"
import { SITE_SURFACES, type AdminToken, type SiteToken } from "./tokens"

type Min = 3 | 4.5
type Scope = "site" | "admin-light" | "admin-dark"
export type ContrastIssue = {
  scope: Scope
  text: string
  surface: string
  ratio: number
  min: Min
}
export type PairRating = ContrastIssue & { rating: "AAA" | "AA" | "fail" }

// Ruling R5: the pairs today's site components draw.
export const SITE_PAIRS: [SiteToken, SiteToken, Min][] = [
  ["text-strong", "cream", 4.5],
  ["text-strong", "stone", 4.5],
  ["text-strong", "surface-soft", 4.5],
  ["text-strong", "surface-warm", 4.5],
  ["text-muted", "cream", 4.5],
  ["text-muted", "stone", 4.5],
  ["text-muted", "surface-soft", 4.5],
  ["text-muted", "surface-warm", 4.5],
  ["ink", "cream", 4.5],
  ["ink-muted", "cream", 4.5],
  ["ink-muted", "stone", 4.5],
  ["cream", "brand", 4.5],
  ["cream", "brand-deep", 4.5],
  ["cream", "pine", 4.5],
  ["cream", "forest", 4.5],
  ["cream", "moss", 4.5],
  ["cream", "hero-base", 4.5],
  ["cream", "spruce", 4.5],
  ["brand", "stone", 4.5],
  ["pine", "brand-mint", 4.5],
  ["pine", "mist", 4.5],
  ["brand", "brand-mint", 4.5],
  ["clay", "cream", 4.5],
  ["text-subtle", "cream", 3],
]

// The pairs tests/css/admin-tokens.test.ts already enforces.
export const ADMIN_PAIRS: [AdminToken, AdminToken, Min][] = [
  ["foreground", "background", 4.5],
  ["foreground", "card", 4.5],
  ["foreground", "sidebar", 4.5],
  ["muted-foreground", "card", 4.5],
  ["muted-foreground", "sidebar", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["primary", "card", 4.5],
  ["primary", "sidebar", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["success", "success-soft", 4.5],
  ["warning", "warning-soft", 4.5],
  ["danger", "danger-soft", 4.5],
  ["hero-foreground", "hero-to", 4.5],
  ["promo-foreground", "promo-to", 4.5],
  ["input", "sidebar", 3],
  ["input", "card", 3],
  ["input", "background", 3],
]

const SITE_LABELS: Record<SiteToken, string> = {
  brand: "Brand",
  "brand-mint": "Brand mint",
  cream: "Cream",
  "brand-deep": "Brand deep",
  clay: "Clay (accent)",
  stone: "Stone",
  mist: "Mist",
  forest: "Forest",
  pine: "Pine",
  ink: "Ink",
  "ink-muted": "Ink muted",
  "text-strong": "Strong text",
  "text-muted": "Muted text",
  "text-subtle": "Subtle text",
  line: "Lines",
  "line-soft": "Soft lines",
  "line-neutral": "Neutral lines",
  "line-faint": "Faint lines",
  "line-rule": "Rules",
  "surface-soft": "Soft surface",
  "surface-warm": "Warm surface",
  "hero-base": "Hero base",
  moss: "Moss",
  spruce: "Spruce",
}
const ADMIN_LABELS: Partial<Record<AdminToken, string>> = {
  foreground: "Text",
  background: "Canvas",
  card: "Cards",
  sidebar: "Panels",
  "muted-foreground": "Muted text",
  primary: "Primary",
  "primary-foreground": "Text on primary",
  accent: "Accent",
  "accent-foreground": "Text on accent",
  success: "Success text",
  "success-soft": "Success fill",
  warning: "Warning text",
  "warning-soft": "Warning fill",
  danger: "Danger text",
  "danger-soft": "Danger fill",
  "hero-foreground": "Hero text",
  "hero-to": "Hero card",
  "promo-foreground": "Promo text",
  "promo-to": "Promo card",
  input: "Control edges",
}

export function tokenLabel(scope: Scope, token: string): string {
  return scope === "site"
    ? (SITE_LABELS[token as SiteToken] ?? token)
    : (ADMIN_LABELS[token as AdminToken] ?? token)
}

export function rating(ratio: number, min: Min): "AAA" | "AA" | "fail" {
  if (ratio < min) return "fail"
  return ratio >= (min === 3 ? 4.5 : 7) ? "AAA" : "AA"
}

export function pairRatings(config: ThemeConfigValue): PairRating[] {
  const rows: PairRating[] = []
  const add = (
    scope: Scope,
    t: Record<string, Oklch>,
    pairs: [string, string, Min][]
  ) => {
    for (const [text, surface, min] of pairs) {
      const ratio = contrast(t[text]!, t[surface]!)
      rows.push({
        scope,
        text,
        surface,
        ratio,
        min,
        rating: rating(ratio, min),
      })
    }
  }
  add("site", resolveSiteTokens(config.site), SITE_PAIRS)
  add("admin-light", buildAdminTokens(config.admin, "light"), ADMIN_PAIRS)
  add("admin-dark", buildAdminTokens(config.admin, "dark"), ADMIN_PAIRS)
  return rows
}

export function checkTheme(config: ThemeConfigValue): ContrastIssue[] {
  return pairRatings(config)
    .filter((r) => r.rating === "fail")
    .map(({ scope, text, surface, ratio, min }) => ({
      scope,
      text,
      surface,
      ratio,
      min,
    }))
}

const SCOPE_PREFIX: Record<Scope, string> = {
  site: "",
  "admin-light": "Admin (light): ",
  "admin-dark": "Admin (dark): ",
}

// Floors to 2 places, so a failing 4.499 never prints as "4.50".
export function describeIssue(issue: ContrastIssue): string {
  const ratio = (Math.floor(issue.ratio * 100) / 100).toFixed(2)
  const use = issue.min === 3 ? "large text and controls" : "body text"
  return `${SCOPE_PREFIX[issue.scope]}${tokenLabel(issue.scope, issue.text)} on ${tokenLabel(issue.scope, issue.surface)} is ${ratio}:1; it needs ${issue.min}:1 (${use}).`
}

const stillFails = (config: ThemeConfigValue, issue: ContrastIssue) =>
  checkTheme(config).some(
    (i) =>
      i.scope === issue.scope &&
      i.text === issue.text &&
      i.surface === issue.surface
  )

// Ruling R6.
export function fixIssue(
  config: ThemeConfigValue,
  issue: ContrastIssue
): ThemeConfigValue | null {
  if (issue.scope === "site") {
    const tokens = resolveSiteTokens(config.site)
    const textIsSurface = SITE_SURFACES.includes(issue.text as SiteToken)
    const moving = (textIsSurface ? issue.surface : issue.text) as SiteToken
    const fixedToken = (textIsSurface ? issue.text : issue.surface) as SiteToken
    const next = nudge(tokens[moving], tokens[fixedToken], issue.min)
    if (!next) return null
    const value = formatOklch(next)
    const site =
      moving === "brand"
        ? { ...config.site, brand: value }
        : { ...config.site, tokens: { ...config.site.tokens, [moving]: value } }
    return { ...config, site }
  }
  const touches = (names: string[]) =>
    names.includes(issue.text) || names.includes(issue.surface)
  const field = touches([
    "primary",
    "sidebar-primary",
    "primary-foreground",
    "ring",
  ])
    ? "primary"
    : touches(["accent", "accent-foreground"])
      ? "accent"
      : null
  if (!field) return null
  const mode = issue.scope === "admin-light" ? "light" : "dark"
  const start =
    (config.admin[field] && parseColor(config.admin[field]!)) ||
    buildAdminTokens(config.admin, "light")[field]
  // Darken for a light-mode failure, lighten for a dark one.
  const step = mode === "light" ? -0.01 : 0.01
  for (let i = 1; i <= 60; i++) {
    const l = start.l + step * i
    if (l < 0 || l > 1) break
    const candidate = {
      ...config,
      admin: { ...config.admin, [field]: formatOklch({ ...start, l }) },
    }
    if (!stillFails(candidate, issue)) return candidate
  }
  return null
}

export function fixAll(config: ThemeConfigValue) {
  let current = config
  for (let round = 0; round < 10; round++) {
    const issues = checkTheme(current)
    const fixable = issues.map((i) => fixIssue(current, i)).find(Boolean)
    if (!fixable) return { config: current, remaining: issues }
    current = fixable
  }
  return { config: current, remaining: checkTheme(current) }
}

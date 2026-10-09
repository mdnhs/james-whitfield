// tests/css/admin-tokens.test.ts
import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const css = readFileSync(
  path.join(import.meta.dirname, "../../app/(admin)/admin.css"),
  "utf8"
)

// The declarations inside the first `<selector> {` block, as written.
function declarations(selector: string) {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`admin.css has no ${selector} block`)
  const body = css.slice(start, css.indexOf("}", start))
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim().toLowerCase(),
    ])
  )
}

const light = declarations(':root[data-theme="admin"]')
// Dark only overrides; anything it leaves out falls back to light.
const dark = { ...light, ...declarations(':root[data-theme="admin"].dark') }

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const REQUIRED = [
  "background",
  "foreground",
  "card",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "accent",
  "accent-foreground",
  "border",
  "ring",
  "sidebar",
  "chart-1",
  "chart-5",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "danger",
  "danger-soft",
  "hatch",
  "hero-from",
  "hero-to",
  "hero-foreground",
  "promo-from",
  "promo-to",
  "promo-foreground",
]

// Text/background pairs the components actually use. Muted text never sits
// on the bare canvas (only on cards and panels), so that pair is not here.
const PAIRS: [text: string, surface: string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "sidebar"],
  ["muted-foreground", "card"],
  ["muted-foreground", "sidebar"],
  ["primary-foreground", "primary"],
  ["primary", "card"],
  // Links and active nav icons sit directly on the panels.
  ["primary", "sidebar"],
  ["accent-foreground", "accent"],
  ["success", "success-soft"],
  ["warning", "warning-soft"],
  ["danger", "danger-soft"],
  ["hero-foreground", "hero-to"],
  ["promo-foreground", "promo-to"],
]

describe.each([
  ["light", light],
  ["dark", dark],
])("%s Evergreen tokens", (_name, tokens) => {
  it.each(REQUIRED)("defines --%s", (token) => {
    expect(tokens[token]).toBeTruthy()
  })

  it.each(PAIRS)("%s on %s meets WCAG AA (4.5:1)", (text, surface) => {
    expect(contrast(tokens[text], tokens[surface])).toBeGreaterThanOrEqual(4.5)
  })

  // The inspiration's layering: panels stand off the canvas and cards stand
  // off the panels, rather than reading as one flat surface.
  it.each([
    ["sidebar", "background"],
    ["card", "sidebar"],
  ])("--%s is distinct from --%s", (a, b) => {
    expect(contrast(tokens[a], tokens[b])).toBeGreaterThanOrEqual(1.08)
  })
})

describe("type scale", () => {
  it.each(["--text-title:", "--text-card-title:", "--text-kpi:"])(
    "declares %s",
    (token) => {
      expect(css).toContain(token)
    }
  )
})

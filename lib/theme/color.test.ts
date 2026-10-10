// lib/theme/color.test.ts
import { describe, expect, it } from "vitest"

import {
  BLACK,
  contrast,
  fit,
  formatOklch,
  nudge,
  onColor,
  parseColor,
  scale,
  toHex,
  WHITE,
} from "./color"

// Today's palette (site.css @theme, admin.css): every value must survive
// hex → canonical OKLCH → hex unchanged, or Teal Sage would drift (R1).
const BASE_HEX = [
  "#336060",
  "#d6e8e4",
  "#faf6f0",
  "#245f60",
  "#b55441",
  "#f3f4ee",
  "#d9e5e5",
  "#245333",
  "#1e4f50",
  "#030303",
  "#3d3d3d",
  "#0c0c0c",
  "#525252",
  "#8a8f88",
  "#dfe2d8",
  "#e7e9e0",
  "#ececec",
  "#f2f2f2",
  "#d8dccf",
  "#f8f9f5",
  "#fcfaf7",
  "#0d120f",
  "#315d44",
  "#002620",
  "#ffffff",
  "#111411",
  "#157d38",
  "#e9ece9",
  "#eef0ee",
  "#666c67",
  "#e6f4eb",
  "#14532d",
  "#dc2626",
  "#e5e8e5",
  "#7d867e",
  "#22a055",
  "#0c100d",
  "#1c251f",
  "#eef2ee",
  "#34b567",
  "#06130a",
  "#9aa39c",
]

// Deterministic PRNG so the property test never flakes.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

describe("parseColor", () => {
  it("normalises hex to canonical OKLCH", () => {
    expect(formatOklch(parseColor("#336060")!)).toMatch(
      /^oklch\(0\.\d{1,4} 0\.\d{1,4} \d{1,3}(\.\d{1,2})?\)$/
    )
    expect(parseColor("#FFFFFF")).toEqual({ l: 1, c: 0, h: 0 })
    expect(parseColor("  #000000 ")).toEqual({ l: 0, c: 0, h: 0 })
  })

  it("accepts oklch() with a percentage lightness and deg hue", () => {
    expect(parseColor("oklch(52% 0.1 190deg)")).toEqual(
      parseColor("oklch(0.52 0.1 190)")
    )
  })

  it.each(BASE_HEX)("round-trips %s exactly", (hex) => {
    expect(toHex(parseColor(hex)!)).toBe(hex)
  })

  it("refuses everything but #rrggbb and oklch()", () => {
    for (const input of [
      "#000;}</style><script>alert(1)</script>",
      "oklch(1 0 0);color:red",
      "red",
      "var(--x)",
      "rgb(0 0 0)",
      "#abc",
      "#12345g",
      "oklch(1 0)",
      "",
      "#".padEnd(5000, "a"),
    ])
      expect(parseColor(input)).toBeNull()
  })

  it("gamut-maps out-of-range input into sRGB", () => {
    const wild = parseColor("oklch(0.7 0.4 150)")!
    expect(wild.c).toBeLessThan(0.4)
    expect(toHex(wild)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it("an achromatic colour has hue 0 and a hue of 360 wraps to 0", () => {
    expect(parseColor("#808080")!.h).toBe(0)
    expect(parseColor("oklch(0.5 0.1 360)")!.h).toBe(0)
  })
})

describe("formatOklch", () => {
  it("writes only numbers", () => {
    expect(formatOklch({ l: 0.45123456, c: 0.06, h: 194.7712 })).toBe(
      "oklch(0.4512 0.06 194.77)"
    )
  })
})

describe("contrast", () => {
  it("matches WCAG for black on white", () => {
    expect(contrast(BLACK, WHITE)).toBeCloseTo(21, 5)
  })
  it("matches the Teal Sage clay/cream pair (4.53:1)", () => {
    expect(
      contrast(parseColor("#b55441")!, parseColor("#faf6f0")!)
    ).toBeCloseTo(4.53, 2)
  })
})

describe("scale", () => {
  it("builds 11 displayable steps, light to dark, with eased chroma", () => {
    const steps = scale(parseColor("#336060")!)
    expect(steps).toHaveLength(11)
    for (let i = 1; i < steps.length; i++)
      expect(steps[i]!.l).toBeLessThan(steps[i - 1]!.l)
    for (const step of steps) expect(fit(step)).toEqual(step)
    expect(steps[0]!.c).toBeLessThan(steps[5]!.c)
    expect(steps[10]!.c).toBeLessThan(steps[5]!.c)
  })
})

describe("onColor", () => {
  it("is always at least 4.5:1 (500 seeded colours)", () => {
    const next = rng(42)
    for (let i = 0; i < 500; i++) {
      const bg = fit({ l: next(), c: next() * 0.37, h: next() * 360 })
      expect(contrast(onColor(bg), bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it("prefers white on a dark brand", () => {
    expect(onColor(parseColor("#157d38")!)).toEqual(WHITE)
  })
})

describe("nudge", () => {
  it("moves a colour away from the fixed one until the pair passes", () => {
    const text = parseColor("#cccccc")!
    const surface = parseColor("#faf6f0")!
    const fixed = nudge(text, surface, 4.5)!
    expect(contrast(fixed, surface)).toBeGreaterThanOrEqual(4.5)
    expect(fixed.l).toBeLessThan(text.l)
  })
  it("returns null when no lightness can pass", () => {
    expect(nudge(WHITE, parseColor("#777777")!, 21)).toBeNull()
  })
})

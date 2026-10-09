import { describe, expect, it } from "vitest"

import { themeCss } from "./theme"

describe("themeCss", () => {
  it("writes valid tokens as :root custom properties", () => {
    expect(themeCss({ brand: "#336060", clay: "#b55441" })).toBe(
      ":root{--color-brand:#336060;--color-clay:#b55441}"
    )
  })
  it("never writes anything but a hex colour into the style tag", () => {
    expect(themeCss({ brand: "#000000;}</style><script>" } as never)).toBe("")
    expect(themeCss({})).toBe("")
  })
})

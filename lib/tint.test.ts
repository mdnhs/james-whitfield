import { describe, expect, it } from "vitest"

import { tintStyle } from "./tint"

describe("tintStyle", () => {
  it("matches Tailwind's bg-pine/90 colour", () => {
    expect(tintStyle(0.9)).toEqual({
      backgroundColor:
        "color-mix(in oklab, var(--color-pine) 90%, transparent)",
    })
  })
  it("clamps and keeps one decimal", () => {
    expect(tintStyle(0.625).backgroundColor).toContain(" 62.5%")
    expect(tintStyle(2).backgroundColor).toContain(" 100%")
  })
})

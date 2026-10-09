import { describe, expect, it } from "vitest"

import { slugify } from "./utils"

describe("slugify", () => {
  it("turns a label into a URL-safe slug", () => {
    expect(slugify("Anxiety & Stress")).toBe("anxiety-stress")
  })

  it("trims leading and trailing separators", () => {
    expect(slugify("  Sleep / Rest! ")).toBe("sleep-rest")
  })

  it("keeps digits", () => {
    expect(slugify("Top 10 Habits")).toBe("top-10-habits")
  })
})

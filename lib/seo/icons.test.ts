import { describe, expect, it } from "vitest"

import { iconHref, iconVersion } from "./icons"

describe("icons", () => {
  it("versions by source so a replaced icon busts caches", () => {
    expect(iconVersion("/uploads/a.png")).toMatch(/^[0-9a-f]{8}$/)
    expect(iconVersion("/uploads/a.png")).toBe(iconVersion("/uploads/a.png"))
    expect(iconVersion("/uploads/a.png")).not.toBe(
      iconVersion("/uploads/b.png")
    )
  })
  it("builds the route address", () => {
    expect(iconHref(32, "abcd1234")).toBe("/site-icon/32?v=abcd1234")
  })
})

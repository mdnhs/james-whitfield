import { describe, expect, it } from "vitest"

import { isShareImageSize } from "./share-image"

describe("isShareImageSize", () => {
  it("accepts 1200×630 and larger images of the same ratio", () => {
    expect(isShareImageSize({ width: 1200, height: 630 })).toBe(true)
    expect(isShareImageSize({ width: 2400, height: 1260 })).toBe(true)
  })
  it("rejects small or off-ratio images", () => {
    expect(isShareImageSize({ width: 1000, height: 525 })).toBe(false)
    expect(isShareImageSize({ width: 1200, height: 1200 })).toBe(false)
    expect(isShareImageSize({ width: 1600, height: 630 })).toBe(false)
  })
})

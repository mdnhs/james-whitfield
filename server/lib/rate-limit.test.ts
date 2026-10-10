import { describe, expect, it } from "vitest"

import { takeToken } from "./rate-limit"

describe("takeToken", () => {
  it("allows `limit` calls per window and resets after it", () => {
    const opts = { limit: 3, windowMs: 1000 }
    expect([1, 2, 3, 4].map(() => takeToken("k", opts, 0))).toEqual([
      true,
      true,
      true,
      false,
    ])
    expect(takeToken("other", opts, 0)).toBe(true)
    expect(takeToken("k", opts, 1000)).toBe(true)
  })
})

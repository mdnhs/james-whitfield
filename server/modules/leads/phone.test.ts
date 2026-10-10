import { describe, expect, it } from "vitest"

import { toE164 } from "./phone"

describe("toE164", () => {
  it.each([
    ["087 123 4567", "+353871234567"],
    ["+44 20 7946 0958", "+442079460958"],
    ["(01) 234 5678", "+35312345678"],
  ])("normalises %s", (raw, e164) => expect(toE164(raw)).toBe(e164))
  it("returns null for an impossible number", () =>
    expect(toE164("123")).toBeNull())
})

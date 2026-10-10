import { describe, expect, it } from "vitest"

import { checkStamp, issueStamp, STAMP_MAX_MS } from "./stamp"

describe("form stamp", () => {
  const t = 1_800_000_000_000
  it("accepts a stamp older than 3 s", () => {
    expect(checkStamp(issueStamp(t), t + 3_000)).toBe("ok")
  })
  it("flags a fast fill", () => {
    expect(checkStamp(issueStamp(t), t + 2_999)).toBe("too-fast")
  })
  it("flags missing, forged, future and expired stamps", () => {
    expect(checkStamp(undefined, t)).toBe("stamp")
    expect(checkStamp(`${t}.deadbeef`, t + 5_000)).toBe("stamp")
    expect(checkStamp(issueStamp(t + 60_000), t)).toBe("stamp")
    expect(checkStamp(issueStamp(t), t + STAMP_MAX_MS + 1)).toBe("stamp")
  })
})

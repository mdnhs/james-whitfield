import { describe, expect, it } from "vitest"

import { countAttrs, formatCount, statText, type StatValue } from "./count"

const count = (value: number, decimals = 0, prefix = "", suffix = "") =>
  ({ kind: "count", value, decimals, prefix, suffix }) satisfies StatValue

describe("count stats", () => {
  it("renders today's stat strings exactly", () => {
    expect(statText(count(10, 0, "", "+"))).toBe("10+")
    expect(statText(count(800, 0, "", "+"))).toBe("800+")
    expect(statText(count(3))).toBe("3")
    expect(statText(count(4.9, 1, "", "/5"))).toBe("4.9/5")
    expect(statText({ kind: "text", text: "ICF / EMCC" })).toBe("ICF / EMCC")
  })

  it("groups thousands and keeps decimals while counting", () => {
    expect(formatCount(1200, 0)).toBe("1,200")
    expect(formatCount(2.45, 1)).toBe("2.5")
    expect(formatCount(0, 1)).toBe("0.0")
  })

  it("exposes count data to the motion layer and nothing for text stats", () => {
    expect(countAttrs(count(4.9, 1, "", "/5"))).toEqual({
      "data-motion": "count",
      "data-count-value": "4.9",
      "data-count-decimals": "1",
      "data-count-prefix": "",
      "data-count-suffix": "/5",
    })
    expect(countAttrs({ kind: "text", text: "Certified" })).toEqual({})
  })
})

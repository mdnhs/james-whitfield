import { describe, expect, it } from "vitest"

import { pairRows, splitColumns, stepsTimeline } from "./layout-math"

describe("stepsTimeline", () => {
  it("reproduces the values tuned for four steps", () => {
    const t = stepsTimeline(4)
    expect(t.beat).toBe(24)
    expect(t.spacer).toBe("260svh")
    expect([1, 2, 3].map(t.surface)).toEqual([
      { start: 8, end: 28 },
      { start: 32, end: 52 },
      { start: 56, end: 76 },
    ])
  })
  it("keeps every window inside the pin for 3 to 6 steps", () => {
    for (const n of [3, 5, 6]) {
      const t = stepsTimeline(n)
      expect(t.surface(n - 1).end).toBeLessThanOrEqual(100)
      expect(t.spacer).toBe(`${65 * n}svh`)
    }
  })
})

describe("splitColumns", () => {
  it("fills the left column first, as the old pre-split data did", () => {
    expect(splitColumns([1, 2, 3, 4, 5, 6, 7], 2)).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7],
    ])
  })
  it("drops empty columns", () => {
    expect(splitColumns([1], 2)).toEqual([[1]])
    expect(splitColumns([], 2)).toEqual([])
  })
})

describe("pairRows", () => {
  it("pads the shorter list with null", () => {
    expect(pairRows(["a", "b", "c"], ["x"])).toEqual([
      ["a", "x"],
      ["b", null],
      ["c", null],
    ])
  })
})

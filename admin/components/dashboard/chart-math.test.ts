import { describe, expect, it } from "vitest"

import { gaugeSummary, peakIndex } from "./chart-math"

describe("gaugeSummary", () => {
  it("shares the first segment of the total", () => {
    const summary = gaugeSummary([
      { key: "done", label: "Complete", value: 41, tone: "solid" },
      { key: "work", label: "Needs work", value: 30, tone: "dark" },
      { key: "missing", label: "Missing", value: 29, tone: "hatched" },
    ])
    expect(summary.total).toBe(100)
    expect(summary.ratio).toBeCloseTo(0.41)
  })

  it("treats negative or missing values as zero", () => {
    const summary = gaugeSummary([
      { key: "a", label: "A", value: -3, tone: "solid" },
      { key: "b", label: "B", value: Number.NaN, tone: "dark" },
    ])
    expect(summary).toMatchObject({ total: 0, ratio: 0 })
    expect(summary.parts.map((part) => part.value)).toEqual([0, 0])
  })
})

describe("peakIndex", () => {
  it("finds the first highest value", () => {
    expect(peakIndex([3, 9, 4, 9])).toBe(1)
    expect(peakIndex([])).toBe(-1)
  })
})

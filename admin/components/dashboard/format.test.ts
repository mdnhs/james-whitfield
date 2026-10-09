import { describe, expect, it } from "vitest"

import {
  formatDelta,
  formatNumber,
  formatPercent,
  formatShare,
  relativeTime,
} from "./format"

describe("formatDelta", () => {
  it("signs the change", () => {
    expect(formatDelta(112.5, 100)).toEqual({
      label: "+12.5%",
      direction: "up",
    })
    expect(formatDelta(50, 100)).toEqual({ label: "-50%", direction: "down" })
  })

  it("calls a tiny change no change", () => {
    expect(formatDelta(1000, 1000.1)).toEqual({
      label: "No change",
      direction: "flat",
    })
  })

  it("has no percentage without a baseline", () => {
    expect(formatDelta(4, 0)).toBeNull()
    expect(formatDelta(0, 0)).toEqual({ label: "No change", direction: "flat" })
  })
})

describe("formatShare", () => {
  it("rounds down, so only the whole reads 100%", () => {
    expect(formatShare(199, 200)).toBe("99%")
    expect(formatShare(200, 200)).toBe("100%")
    expect(formatShare(1, 3)).toBe("33%")
    expect(formatShare(29, 100)).toBe("29%")
  })

  it("shows a dash when there is nothing to measure", () => {
    expect(formatShare(0, 0)).toBe("—")
  })
})

describe("formatting", () => {
  it("uses Irish English", () => {
    expect(formatNumber(12345)).toBe("12,345")
    expect(formatPercent(0.41)).toBe("41%")
  })

  it("says how long ago", () => {
    const now = Date.parse("2026-10-09T10:00:00Z")
    expect(relativeTime("2026-10-09T09:59:30Z", now)).toBe("just now")
    expect(relativeTime("2026-10-09T09:55:00Z", now)).toBe("5 minutes ago")
    expect(relativeTime("2026-10-09T08:00:00Z", now)).toBe("2 hours ago")
    expect(relativeTime("2026-10-08T10:00:00Z", now)).toBe("yesterday")
  })
})

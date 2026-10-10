import { describe, expect, it } from "vitest"

import { dublinLocalToIso, isoToDublinLocal } from "./schedule-time"

// Review Focus 5: the picker shows Dublin wall time (docs/brief.md §8.2).
describe("schedule time", () => {
  it("converts summer (IST, UTC+1) and winter (GMT) wall times", () => {
    expect(new Date(dublinLocalToIso("2026-07-01T10:00")).toISOString()).toBe(
      "2026-07-01T09:00:00.000Z"
    )
    expect(new Date(dublinLocalToIso("2026-12-01T10:00")).toISOString()).toBe(
      "2026-12-01T10:00:00.000Z"
    )
  })
  it("round-trips and rejects junk", () => {
    expect(isoToDublinLocal("2026-07-01T09:00:00.000Z")).toBe(
      "2026-07-01T10:00"
    )
    expect(() => dublinLocalToIso("tomorrow")).toThrow()
  })
})

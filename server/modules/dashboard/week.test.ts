import { describe, expect, it } from "vitest"

import { weekWindow } from "./week"

const HOUR = 3_600_000

describe("weekWindow (Europe/Dublin, Monday first)", () => {
  it("starts at Monday 00:00 Irish time", () => {
    // Thursday 00:30 IST.
    const week = weekWindow(new Date("2026-10-07T23:30:00Z"))
    expect(week.start.toISOString()).toBe("2026-10-04T23:00:00.000Z")
    expect(week.end.toISOString()).toBe("2026-10-11T23:00:00.000Z")
    expect(week.days.map((day) => day.key)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ])
    expect(week.days[0].label).toBe("Mon")
  })

  it("puts Sunday 23:30 UTC (Monday in Dublin) in the new week", () => {
    const week = weekWindow(new Date("2026-10-11T23:30:00Z"))
    expect(week.start.toISOString()).toBe("2026-10-11T23:00:00.000Z")
  })

  it("spans the October clock change as a 169-hour week", () => {
    const week = weekWindow(new Date("2026-10-25T12:00:00Z"))
    expect(week.start.toISOString()).toBe("2026-10-18T23:00:00.000Z")
    expect(week.end.toISOString()).toBe("2026-10-26T00:00:00.000Z")
    expect((week.end.getTime() - week.start.getTime()) / HOUR).toBe(169)
    expect(week.days.at(-1)?.key).toBe("2026-10-25")
  })

  it("gives the previous week's days, ending where this week starts", () => {
    const week = weekWindow(new Date("2026-10-25T12:00:00Z"))
    expect(week.previousStart.toISOString()).toBe("2026-10-11T23:00:00.000Z")
    expect(week.previousDays[0].key).toBe("2026-10-12")
    expect(week.previousDays.at(-1)?.key).toBe("2026-10-18")
  })

  it("spans the March clock change as a 167-hour week", () => {
    // Sunday 29 March 2026, 01:00 GMT → 02:00 IST.
    const week = weekWindow(new Date("2026-03-29T12:00:00Z"))
    expect(week.start.toISOString()).toBe("2026-03-23T00:00:00.000Z")
    expect(week.end.toISOString()).toBe("2026-03-29T23:00:00.000Z")
    expect((week.end.getTime() - week.start.getTime()) / HOUR).toBe(167)
    expect(week.days.map((day) => day.label)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ])
  })

  it("starts the week after the October change at midnight GMT", () => {
    // Monday 26 October 2026, 00:30 GMT.
    const week = weekWindow(new Date("2026-10-26T00:30:00Z"))
    expect(week.start.toISOString()).toBe("2026-10-26T00:00:00.000Z")
    expect(week.previousStart.toISOString()).toBe("2026-10-18T23:00:00.000Z")
    expect(week.days[0].key).toBe("2026-10-26")
  })

  it("keeps Sunday 23:30 GMT in winter in the old week", () => {
    const week = weekWindow(new Date("2026-12-13T23:30:00Z"))
    expect(week.start.toISOString()).toBe("2026-12-07T00:00:00.000Z")
    expect(week.days.at(-1)?.key).toBe("2026-12-13")
  })
})

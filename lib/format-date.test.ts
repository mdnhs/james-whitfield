import { describe, expect, it } from "vitest"

import { articleDate } from "./format-date"

describe("articleDate", () => {
  it("prints the labels the articles show today, in Dublin time", () => {
    const at = (iso: string) => articleDate(new Date(`${iso}T12:00:00Z`))
    expect(at("2026-09-02")).toEqual({
      iso: "2026-09-02",
      label: "2nd Sep, 2026",
    })
    expect(at("2026-08-24").label).toBe("24th Aug, 2026")
    expect(at("2026-08-01").label).toBe("1st Aug, 2026")
    expect(at("2026-07-22").label).toBe("22nd Jul, 2026")
    expect(at("2026-07-13").label).toBe("13th Jul, 2026")
    expect(at("2026-07-11").label).toBe("11th Jul, 2026")
  })
  it("uses the Dublin calendar day, not UTC", () => {
    expect(articleDate(new Date("2026-08-31T23:30:00Z")).iso).toBe("2026-09-01")
  })
})

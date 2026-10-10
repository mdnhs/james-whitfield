import { describe, expect, it } from "vitest"

import { toCsv } from "./csv"

const cols = [
  { key: "name", label: "Name" },
  { key: "message", label: "Message" },
]

describe("toCsv", () => {
  it("neutralises formulas, doubles quotes and keeps newlines quoted", () => {
    const csv = toCsv(
      [
        {
          name: '=HYPERLINK("https://evil.example")',
          message: 'He said "hi"\nthen left',
        },
        { name: "+1-555", message: "@SUM(A1)" },
        { name: "-2", message: "\tTab" },
      ],
      cols
    )
    expect(csv.split("\r\n")[0]).toBe("Name,Message")
    expect(csv).toContain(`"'=HYPERLINK(""https://evil.example"")"`)
    expect(csv).toContain(`"He said ""hi""\nthen left"`)
    expect(csv).toContain(`"'+1-555","'@SUM(A1)"`)
    expect(csv).toContain(`"'-2","'\tTab"`)
    expect(csv.startsWith("﻿")).toBe(false)
  })
  it("renders null and dates", () => {
    expect(
      toCsv([{ name: null, message: new Date("2026-01-02T03:04:05Z") }], cols)
    ).toContain(`"","2026-01-02T03:04:05.000Z"`)
  })
})

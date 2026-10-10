import { describe, expect, it } from "vitest"

import { diffRows } from "./diff"

describe("diffRows", () => {
  it("lists fields alphabetically with readable values", () => {
    expect(
      diffRows({
        title: { from: "Old", to: "New" },
        count: { from: 1, to: 2 },
      })
    ).toEqual([
      { field: "count", from: "1", to: "2" },
      { field: "title", from: "Old", to: "New" },
    ])
  })

  it("renders non-objects and nulls as text", () => {
    expect(diffRows({ a: { from: null, to: { x: [1] } } })).toEqual([
      { field: "a", from: "—", to: '{\n  "x": [\n    1\n  ]\n}' },
    ])
    expect(diffRows("junk")).toEqual([])
    expect(diffRows(null)).toEqual([])
    expect(diffRows({ broken: 5 })).toEqual([
      { field: "broken", from: "—", to: "5" },
    ])
  })

  it("clips long values and keeps markup as text", () => {
    const [row] = diffRows({
      body: { from: "<script>x</script>", to: "y".repeat(5000) },
    })
    expect(row!.from).toBe("<script>x</script>")
    expect(row!.to.length).toBeLessThanOrEqual(2001)
    expect(row!.to.endsWith("…")).toBe(true)
  })

  it("never treats __proto__ as special", () => {
    const diff = JSON.parse('{"__proto__": {"from": 1, "to": 2}}')
    expect(diffRows(diff)).toEqual([{ field: "__proto__", from: "1", to: "2" }])
  })
})

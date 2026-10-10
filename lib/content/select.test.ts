import { describe, expect, it } from "vitest"

import { select } from "./select"

describe("select", () => {
  const items = [{ id: "a" }, { id: "b" }]
  it("returns everything for all", () => {
    expect(select(items, { mode: "all" })).toEqual(items)
  })
  it("follows the editor's order and drops unknown ids", () => {
    expect(select(items, { mode: "chosen", ids: ["b", "x", "a"] })).toEqual([
      { id: "b" },
      { id: "a" },
    ])
  })
})

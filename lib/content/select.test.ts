import { describe, expect, it } from "vitest"

import { PLAN_LIMIT, select, visiblePlans } from "./select"

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

describe("visiblePlans", () => {
  it("lists exactly the plans the block shows", () => {
    const plans = Array.from({ length: 6 }, (_, i) => ({ id: String(i) }))
    expect(visiblePlans(plans)).toHaveLength(PLAN_LIMIT)
    expect(visiblePlans(plans.slice(0, 2))).toHaveLength(2)
  })
})

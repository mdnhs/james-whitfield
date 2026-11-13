import { describe, expect, it } from "vitest"

import { PLAN_LIMIT, select, visiblePlans, withLivePagePaths } from "./select"

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

describe("withLivePagePaths", () => {
  it("blanks a pagePath that is not a live path", () => {
    const services = [
      { id: "1", pagePath: "/services/anxiety" },
      { id: "2", pagePath: "/services/gone" },
      { id: "3", pagePath: "" },
    ]
    expect(withLivePagePaths(services, ["/services/anxiety"])).toEqual([
      { id: "1", pagePath: "/services/anxiety" },
      { id: "2", pagePath: "" },
      { id: "3", pagePath: "" },
    ])
  })
})

// admin/modules/ai/route-context.test.ts
import { describe, expect, it } from "vitest"

import { contextFromRoute } from "./route-context"
import { STARTERS } from "./starters"

const id = "6f1c1a0e-1b2c-4d3e-8f4a-5b6c7d8e9f00"

describe("contextFromRoute", () => {
  it("names the page or article open in its editor, by id", () => {
    expect(contextFromRoute(`/admin/pages/${id}`, { id })).toEqual({
      screen: "page",
      context: { path: `/admin/pages/${id}`, entity: { type: "page", id } },
    })
    expect(contextFromRoute(`/admin/insights/${id}`, { id })).toEqual({
      screen: "article",
      context: {
        path: `/admin/insights/${id}`,
        entity: { type: "article", id },
      },
    })
    // The segment alone is enough when the router has no params here.
    expect(contextFromRoute(`/admin/pages/${id}`)?.screen).toBe("page")
  })

  it("never treats other screens as an editor", () => {
    expect(contextFromRoute("/admin/insights/authors")).toEqual({
      screen: "default",
      context: { path: "/admin/insights/authors" },
    })
    expect(contextFromRoute("/admin/pages")?.screen).toBe("default")
    expect(contextFromRoute(`/admin/pages/${id}/x`)?.screen).toBe("default")
    expect(
      contextFromRoute(`/admin/pages/${id}`, { id: "other" })?.screen
    ).toBe("default")
    expect(contextFromRoute("/admin/leads")).toEqual({
      screen: "leads",
      context: { path: "/admin/leads" },
    })
    expect(contextFromRoute("/about")).toBeNull()
  })

  it("keeps the path within the server's 200 characters", () => {
    const long = `/admin/${"x".repeat(300)}`
    expect(contextFromRoute(long)!.context.path).toHaveLength(200)
  })
})

describe("STARTERS", () => {
  it("has four cards with a description for every screen", () => {
    for (const set of Object.values(STARTERS)) {
      expect(set).toHaveLength(4)
      for (const s of set) expect(s.description.length).toBeGreaterThan(0)
    }
  })
})

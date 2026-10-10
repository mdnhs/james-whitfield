import { describe, expect, it } from "vitest"

import { BanInput, RolesInput, UserListQuery } from "./schema"

describe("RolesInput", () => {
  it("orders roles like ROLE_NAMES and refuses duplicates or none", () => {
    expect(RolesInput.parse({ roles: ["viewer", "editor"] }).roles).toEqual([
      "editor",
      "viewer",
    ])
    expect(RolesInput.safeParse({ roles: [] }).success).toBe(false)
    expect(RolesInput.safeParse({ roles: ["editor", "editor"] }).success).toBe(
      false
    )
    expect(RolesInput.safeParse({ roles: ["editor,owner"] }).success).toBe(
      false
    )
  })
})

describe("BanInput", () => {
  it("accepts a reason and 1–365 days, or no end date", () => {
    expect(BanInput.parse({})).toEqual({ days: null })
    expect(BanInput.parse({ reason: "  left  ", days: 7 })).toEqual({
      reason: "left",
      days: 7,
    })
    expect(BanInput.safeParse({ days: 0 }).success).toBe(false)
    expect(BanInput.safeParse({ days: 366 }).success).toBe(false)
    expect(BanInput.safeParse({ reason: "x".repeat(201) }).success).toBe(false)
  })
})

describe("UserListQuery", () => {
  it("coerces paging and bounds the search", () => {
    expect(UserListQuery.parse({ page: "2" })).toMatchObject({
      page: 2,
      pageSize: 50,
    })
    expect(UserListQuery.safeParse({ q: "x".repeat(101) }).success).toBe(false)
    expect(UserListQuery.safeParse({ status: "deleted" }).success).toBe(false)
  })
})

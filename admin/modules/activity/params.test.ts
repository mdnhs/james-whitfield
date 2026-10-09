import { describe, expect, it } from "vitest"

import { toAuditParams, toDay } from "./params"

describe("toAuditParams", () => {
  it("maps URL state to the API's query, dropping empty filters", () => {
    expect(
      toAuditParams({
        page: 2,
        pageSize: 20,
        action: "auth.sign_in",
        actor: null,
        from: new Date("2026-10-05T00:00:00Z"),
        to: null,
      })
    ).toEqual({
      page: 2,
      pageSize: 20,
      action: "auth.sign_in",
      actor: undefined,
      from: "2026-10-05",
      to: undefined,
    })
  })

  it("keeps a hand-edited URL inside the API's limits", () => {
    const params = toAuditParams({
      page: -3,
      pageSize: 5000,
      action: null,
      actor: null,
      from: null,
      to: null,
    })
    expect(params).toMatchObject({ page: 1, pageSize: 100 })
  })
})

describe("toAuditParams on a hand-edited URL", () => {
  const base = {
    page: 1,
    pageSize: 20,
    action: null,
    actor: null,
    from: null,
    to: null,
  }

  it("drops an actor that is not a uuid and an over-long action", () => {
    const params = toAuditParams({
      ...base,
      actor: "nope",
      action: "x".repeat(65),
    })
    expect(params.actor).toBeUndefined()
    expect(params.action).toBeUndefined()
  })

  it("keeps a valid actor", () => {
    const actor = "0b0e7f0e-7d0a-4a5e-9b43-0c1f1d2e3a4b"
    expect(toAuditParams({ ...base, actor }).actor).toBe(actor)
  })

  it("swaps a range that ends before it starts", () => {
    const params = toAuditParams({
      ...base,
      from: new Date("2026-10-07T00:00:00Z"),
      to: new Date("2026-10-05T00:00:00Z"),
    })
    expect(params).toMatchObject({ from: "2026-10-05", to: "2026-10-07" })
  })
})

describe("toDay", () => {
  it("treats an Invalid Date as no day", () => {
    expect(toDay(new Date("275760-01-01"))).toBeUndefined()
    expect(toDay(new Date(Number.NaN))).toBeUndefined()
    expect(toDay(null)).toBeUndefined()
  })
})

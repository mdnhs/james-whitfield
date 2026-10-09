import { describe, expect, it } from "vitest"

import { toAuditParams } from "./params"

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

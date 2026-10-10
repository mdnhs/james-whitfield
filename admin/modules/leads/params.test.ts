import { describe, expect, it } from "vitest"

import { leadsParams, loadLeadsParams } from "./params"

const UUID = "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc"

describe("leadsParams", () => {
  it("parses the view and falls back to the board", () => {
    expect(leadsParams.view.parse("table")).toBe("table")
    expect(loadLeadsParams("?view=bogus").view).toBe("board")
    expect(loadLeadsParams("").view).toBe("board")
  })

  it("defaults the folder to the inbox and drops unknown folders", () => {
    expect(loadLeadsParams("").folder).toBe("inbox")
    expect(loadLeadsParams("?folder=spam").folder).toBe("spam")
    expect(loadLeadsParams("?folder=trash").folder).toBe("inbox")
  })

  it("accepts a uuid lead and rejects anything else", () => {
    expect(loadLeadsParams(`?lead=${UUID}`).lead).toBe(UUID)
    expect(loadLeadsParams("?lead=not-a-uuid").lead).toBeNull()
  })

  it("keeps only board statuses", () => {
    expect(loadLeadsParams("?status=booked").status).toBe("booked")
    expect(loadLeadsParams("?status=spam").status).toBeNull()
  })
})

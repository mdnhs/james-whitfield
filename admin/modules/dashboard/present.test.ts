import { describe, expect, it } from "vitest"

import { actionStatus, firstName, greetingFor } from "./present"

describe("greetingFor (Irish time)", () => {
  it.each([
    ["2026-10-09T05:59:00Z", "Good morning"], // 06:59 IST
    ["2026-10-09T10:59:00Z", "Good morning"], // 11:59 IST
    ["2026-10-09T11:00:00Z", "Good afternoon"], // 12:00 IST
    ["2026-10-09T16:59:00Z", "Good afternoon"], // 17:59 IST
    ["2026-10-09T17:00:00Z", "Good evening"], // 18:00 IST
    ["2026-12-09T23:30:00Z", "Good evening"], // 23:30 GMT
    ["2026-12-09T11:30:00Z", "Good morning"], // 11:30 GMT
  ])("%s → %s", (iso, expected) => {
    expect(greetingFor(new Date(iso))).toBe(expected)
  })
})

describe("firstName", () => {
  it.each([
    ["Sam Shell", "Sam"],
    ["  Magda  ", "Magda"],
    ["", "there"],
  ])("%j → %j", (name, expected) => {
    expect(firstName(name)).toBe(expected)
  })
})

describe("actionStatus", () => {
  it("labels known audit actions", () => {
    expect(actionStatus("auth.sign_in")).toEqual({
      label: "Signed in",
      tone: "success",
    })
    expect(actionStatus("user.invite")).toEqual({
      label: "Invited",
      tone: "info",
    })
    expect(actionStatus("something.else")).toBeUndefined()
  })
})

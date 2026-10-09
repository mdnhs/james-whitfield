import { describe, expect, it } from "vitest"

import {
  actionStatus,
  dashboardGreeting,
  firstName,
  greetingFor,
} from "./present"

describe("greetingFor (Irish time)", () => {
  it.each([
    ["2026-10-08T23:00:00Z", "Good morning"], // 00:00 IST
    ["2026-10-08T22:59:00Z", "Good evening"], // 23:59 IST, the day before
    ["2026-10-09T05:59:00Z", "Good morning"], // 06:59 IST
    ["2026-10-09T10:59:00Z", "Good morning"], // 11:59 IST
    ["2026-10-09T11:00:00Z", "Good afternoon"], // 12:00 IST
    ["2026-10-09T16:59:00Z", "Good afternoon"], // 17:59 IST
    ["2026-10-09T17:00:00Z", "Good evening"], // 18:00 IST
    ["2026-12-09T23:30:00Z", "Good evening"], // 23:30 GMT
    ["2026-12-09T11:30:00Z", "Good morning"], // 11:30 GMT
    ["2026-12-09T12:00:00Z", "Good afternoon"], // 12:00 GMT
    ["2026-12-09T17:59:00Z", "Good afternoon"], // 17:59 GMT
    ["2026-12-09T18:00:00Z", "Good evening"], // 18:00 GMT
  ])("%s → %s", (iso, expected) => {
    expect(greetingFor(new Date(iso))).toBe(expected)
  })
})

describe("dashboardGreeting", () => {
  const evening = "2026-10-09T19:00:00Z" // 20:00 IST
  const morning = "2026-10-09T08:00:00Z" // 09:00 IST

  it("goes by the dashboard answer's time once it has arrived", () => {
    expect(dashboardGreeting("Sam", morning, evening)).toBe("Good morning, Sam")
  })

  it("goes by the page's render time until then", () => {
    expect(dashboardGreeting("Sam", undefined, evening)).toBe(
      "Good evening, Sam"
    )
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

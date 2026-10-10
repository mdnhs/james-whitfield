import { describe, expect, it } from "vitest"

import {
  actionStatus,
  dashboardGreeting,
  firstName,
  greetingFor,
  kpisFor,
  setupSteps,
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

const base = {
  generatedAt: "2026-10-09T10:00:00.000Z",
  enquiries: { value: 0, previous: 0 },
  enquiriesWeek: { days: [], current: 0, previous: 0 },
  articles: { published: 0, scheduled: 0 },
  subscribers: { confirmed: 0, newThisMonth: 0 },
  seoHealth: null,
  contentHealth: null,
  recentActivity: null,
  nextUp: [],
} as unknown as Parameters<typeof kpisFor>[0]

describe("kpisFor", () => {
  it("kpis caption zeros honestly and link only where the viewer may go", () => {
    const kpis = kpisFor(base, () => false)
    expect(kpis.map((k) => [k.label, k.value, k.caption, k.href])).toEqual([
      ["New enquiries", "0", "last 30 days", undefined],
      ["Published articles", "0", "none scheduled", undefined],
      ["Newsletter subscribers", "0", "0 new in 30 days", undefined],
    ])
  })

  it("compares enquiries, adds SEO health and links for an owner", () => {
    const kpis = kpisFor(
      {
        ...base,
        enquiries: { value: 12, previous: 8 },
        articles: { published: 7, scheduled: 1 },
        seoHealth: { score: 92, issues: 1 },
      },
      () => true
    )
    expect(kpis[0]).toMatchObject({
      caption: "vs the 30 days before",
      href: "/admin/leads",
      variant: "hero",
    })
    expect(kpis[1]).toMatchObject({
      caption: "1 scheduled",
      href: "/admin/insights",
    })
    expect(kpis[3]).toMatchObject({
      label: "SEO health",
      value: "92%",
      caption: "1 issue to fix",
      href: "/admin/seo",
    })
  })
})

describe("setupSteps", () => {
  it("keeps only the two setup steps for the checklist", () => {
    const step = (id: string) => ({
      id,
      title: id,
      description: "",
      cta: "",
      href: "",
      done: false,
    })
    expect(
      setupSteps([
        step("enquiry"),
        step("two-factor"),
        step("invite"),
      ] as never).map((s) => s.id)
    ).toEqual(["two-factor", "invite"])
  })
})

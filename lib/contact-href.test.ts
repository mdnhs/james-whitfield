import { describe, expect, it } from "vitest"

import { contactHref } from "./contact-href"

describe("contactHref", () => {
  it("builds the same URLs the site links to today", () => {
    expect(contactHref({ topic: "workplace-wellbeing" })).toBe(
      "/contact?topic=workplace-wellbeing"
    )
    expect(contactHref({ plan: "discovery-call", topic: undefined })).toBe(
      "/contact?plan=discovery-call"
    )
    // Parser order (topic, format, plan) decides the order, not the argument's.
    expect(contactHref({ plan: "discovery-call", topic: "sleep-rest" })).toBe(
      "/contact?topic=sleep-rest&plan=discovery-call"
    )
  })
})

describe("contactHref edge cases", () => {
  it("encodes special characters", () => {
    const href = contactHref({ topic: "a b&c=d/é#?" })
    // & and # can never break out of the value.
    expect(href).toBe("/contact?topic=a+b%26c=d/é%23?")
    const url = new URL(href, "https://example.test")
    expect(url.searchParams.get("topic")).toBe("a b&c=d/é#?")
    expect(url.hash).toBe("")
  })
  it("drops null and undefined values", () => {
    expect(contactHref({ topic: null, format: undefined, plan: null })).toBe(
      "/contact"
    )
    expect(contactHref({})).toBe("/contact")
    expect(contactHref({ topic: null, plan: "x" })).toBe("/contact?plan=x")
  })
})

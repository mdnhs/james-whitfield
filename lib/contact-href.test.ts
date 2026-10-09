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

import { describe, expect, it } from "vitest"

import { badgeText, spamReasonLabel, statusLabel, topicLabel } from "./present"

describe("present", () => {
  it("labels statuses and caps the badge", () => {
    expect(statusLabel("contacted")).toBe("Contacted")
    expect(badgeText(0)).toBeNull()
    expect(badgeText(undefined)).toBeNull()
    expect(badgeText(7)).toBe("7")
    expect(badgeText(99)).toBe("99")
    expect(badgeText(150)).toBe("99+")
  })

  it("explains spam reasons and humanises topics", () => {
    expect(spamReasonLabel("too-fast")).toBe("Submitted too quickly")
    expect(spamReasonLabel("other")).toBe("other")
    expect(spamReasonLabel(null)).toBe("Unknown")
    expect(topicLabel("mental-health")).toBe("Mental health")
  })
})

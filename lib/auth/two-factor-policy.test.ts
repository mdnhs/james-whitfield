import { describe, expect, it } from "vitest"

import * as policy from "./two-factor-policy"

describe("two-factor policy (change 2026-10-11: optional for all roles)", () => {
  it("recommends two-factor more strongly to owners and admins", () => {
    expect(policy.roleRecommendsTwoFactor(["owner"])).toBe(true)
    expect(policy.roleRecommendsTwoFactor(["editor", "admin"])).toBe(true)
    expect(policy.roleRecommendsTwoFactor(["editor", "marketer"])).toBe(false)
  })

  it("no longer forces anyone into setup", () => {
    expect("mustSetUpTwoFactor" in policy).toBe(false)
  })
})

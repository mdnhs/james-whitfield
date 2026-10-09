import { describe, expect, it } from "vitest"

import { mustSetUpTwoFactor, roleRequiresTwoFactor } from "./two-factor-policy"

describe("two-factor policy (brief §7.4)", () => {
  it("requires two-factor for owners and admins only", () => {
    expect(roleRequiresTwoFactor(["owner"])).toBe(true)
    expect(roleRequiresTwoFactor(["editor", "admin"])).toBe(true)
    expect(roleRequiresTwoFactor(["editor", "marketer"])).toBe(false)
  })

  it("sends privileged users without two-factor to setup", () => {
    expect(
      mustSetUpTwoFactor({ roles: ["owner"], twoFactorEnabled: false })
    ).toBe(true)
    expect(
      mustSetUpTwoFactor({ roles: ["owner"], twoFactorEnabled: true })
    ).toBe(false)
    expect(
      mustSetUpTwoFactor({ roles: ["intake"], twoFactorEnabled: false })
    ).toBe(false)
  })
})

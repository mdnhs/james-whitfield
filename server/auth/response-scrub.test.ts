import { describe, expect, it } from "vitest"

import { scrubAuthBody } from "./response-scrub"

describe("scrubAuthBody", () => {
  it("drops a top-level token (sign-in, verify-otp, change-password)", () => {
    expect(
      scrubAuthBody({ redirect: false, token: "t", user: { id: "u" } })
    ).toEqual({ redirect: false, user: { id: "u" } })
  })

  it("drops the session's token, IP address and user agent", () => {
    expect(
      scrubAuthBody({
        session: {
          id: "s",
          token: "t",
          ipAddress: "203.0.113.7",
          userAgent: "Chrome",
          expiresAt: "2026-10-16",
        },
        user: { id: "u" },
      })
    ).toEqual({
      session: { id: "s", expiresAt: "2026-10-16" },
      user: { id: "u" },
    })
  })

  it("leaves bodies with nothing to remove alone", () => {
    for (const value of [
      null,
      undefined,
      "ok",
      [{ token: "t" }],
      { status: true },
      { twoFactorRedirect: true },
    ]) {
      expect(scrubAuthBody(value)).toBeNull()
    }
  })
})

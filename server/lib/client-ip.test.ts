import { describe, expect, it } from "vitest"

import { clientIp } from "./client-ip"

describe("clientIp", () => {
  it("trusts a valid X-Real-IP only", () => {
    expect(clientIp(new Headers({ "x-real-ip": " 203.0.113.9 " }))).toBe(
      "203.0.113.9"
    )
    expect(clientIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe(
      "2001:db8::1"
    )
    expect(clientIp(new Headers({ "x-real-ip": "evil, 1.2.3.4" }))).toBeNull()
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBeNull()
  })
})

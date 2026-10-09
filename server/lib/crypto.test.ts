import { describe, expect, it } from "vitest"

import { hashIp } from "./crypto"

describe("hashIp", () => {
  it("is stable, opaque and never the raw address", () => {
    const hash = hashIp("203.0.113.7")
    expect(hash).toBe(hashIp("203.0.113.7"))
    expect(hash).not.toContain("203.0.113.7")
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
    expect(hashIp("203.0.113.8")).not.toBe(hash)
  })
})

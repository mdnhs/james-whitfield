import { describe, expect, it } from "vitest"

import { authRequest, RATE_LIMITED, UNREACHABLE } from "./auth-errors"

const ok = { data: { ok: true }, error: null }
const failed = (status: number) => ({ data: null, error: { status } })

describe("authRequest", () => {
  it("passes successful data through", async () => {
    expect(await authRequest(async () => ok)).toEqual({
      data: { ok: true },
      failure: null,
    })
  })

  it("reports 429 as rate limited", async () => {
    const { failure } = await authRequest(async () => failed(429))
    expect(failure).toEqual({ kind: "rate-limited", message: RATE_LIMITED })
  })

  it("reports 5xx and thrown network errors as unreachable", async () => {
    for (const call of [
      async () => failed(500),
      async () => failed(503),
      async () => {
        throw new TypeError("Failed to fetch")
      },
    ]) {
      const { failure } = await authRequest(call)
      expect(failure).toEqual({ kind: "unreachable", message: UNREACHABLE })
    }
  })

  it("leaves other errors to the caller", async () => {
    for (const status of [400, 401, 403]) {
      const { failure } = await authRequest(async () => failed(status))
      expect(failure).toEqual({ kind: "rejected", message: null })
    }
  })
})

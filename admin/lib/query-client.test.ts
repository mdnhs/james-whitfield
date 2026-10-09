import { describe, expect, it } from "vitest"

import { ApiError } from "./api-error"
import { getQueryClient } from "./query-client"

describe("getQueryClient on the server", () => {
  it("never shares a client between calls (requests, users)", () => {
    expect(getQueryClient()).not.toBe(getQueryClient())
  })

  it("does not retry 4xx answers, retries anything else once", () => {
    const retry = getQueryClient().getDefaultOptions().queries?.retry
    if (typeof retry !== "function") throw new Error("retry is not a function")
    const forbidden = new ApiError("FORBIDDEN", "No", 403)
    const down = new ApiError("UNAVAILABLE", "Down", 503)
    expect(retry(0, forbidden)).toBe(false)
    expect(retry(0, down)).toBe(true)
    expect(retry(1, down)).toBe(false)
  })
})

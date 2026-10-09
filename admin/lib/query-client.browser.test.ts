// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "./api-error"
import { getQueryClient } from "./query-client"

describe("getQueryClient in the browser", () => {
  it("reuses one client for the whole tab", () => {
    expect(getQueryClient()).toBe(getQueryClient())
  })
})

describe("session errors from any query or mutation", () => {
  const assign = vi.fn()
  const original = window.location

  function at(url: string) {
    const { pathname, search, hash } = new URL(url, "http://localhost")
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname, search, hash, assign },
    })
  }

  beforeEach(() => at("/admin/activity?page=2"))
  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: original,
    })
    assign.mockReset()
    getQueryClient().clear()
  })

  const fail = (code: ApiError["code"], status: number) => async () => {
    throw new ApiError(code, "No", status)
  }

  it("sends an ended session to sign-in, back to where it was", async () => {
    await getQueryClient()
      .fetchQuery({
        queryKey: ["t", "401"],
        queryFn: fail("UNAUTHENTICATED", 401),
        retry: false,
      })
      .catch(() => {})
    expect(assign).toHaveBeenCalledWith(
      `/admin/sign-in?next=${encodeURIComponent("/admin/activity?page=2")}`
    )
  })

  it("sends a session that still needs two-factor to setup", async () => {
    await getQueryClient()
      .getMutationCache()
      .build(getQueryClient(), {
        mutationFn: fail("TWO_FACTOR_REQUIRED", 403),
      })
      .execute(undefined)
      .catch(() => {})
    expect(assign).toHaveBeenCalledWith("/admin/two-factor-setup")
  })

  it("never puts a non-admin path into ?next=", async () => {
    at("/about")
    await getQueryClient()
      .fetchQuery({
        queryKey: ["t", "outside"],
        queryFn: fail("UNAUTHENTICATED", 401),
        retry: false,
      })
      .catch(() => {})
    expect(assign).toHaveBeenCalledWith("/admin/sign-in?next=%2Fadmin")
  })

  it("leaves every other error to the screen that asked", async () => {
    await getQueryClient()
      .fetchQuery({
        queryKey: ["t", "403"],
        queryFn: fail("FORBIDDEN", 403),
        retry: false,
      })
      .catch(() => {})
    expect(assign).not.toHaveBeenCalled()
  })

  it("does not reload the page it is already on", async () => {
    at("/admin/two-factor-setup")
    await getQueryClient()
      .fetchQuery({
        queryKey: ["t", "2fa-here"],
        queryFn: fail("TWO_FACTOR_REQUIRED", 403),
        retry: false,
      })
      .catch(() => {})
    expect(assign).not.toHaveBeenCalled()
  })
})

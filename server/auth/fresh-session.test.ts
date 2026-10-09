import { APIError } from "better-auth/api"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
vi.mock("./auth", () => ({ getAuth: () => ({ api: { getSession } }) }))

import { getFreshSession } from "./fresh-session"

beforeEach(() => {
  getSession.mockReset()
})

describe("getFreshSession", () => {
  it("treats a Better Auth APIError as anonymous", async () => {
    getSession.mockRejectedValue(new APIError("UNAUTHORIZED"))
    expect(await getFreshSession(new Headers())).toEqual({
      session: null,
      setCookies: [],
    })
  })

  it("logs and rethrows unexpected errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    getSession.mockRejectedValue(new Error("db down"))
    await expect(getFreshSession(new Headers())).rejects.toThrow("db down")
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("always bypasses the cookie cache", async () => {
    getSession.mockResolvedValue({ headers: new Headers(), response: null })
    await getFreshSession(new Headers())
    expect(getSession.mock.calls[0][0].query).toEqual({
      disableCookieCache: true,
    })
  })

  it("forwards refreshed cookies", async () => {
    const headers = new Headers()
    headers.append("set-cookie", "mk.session_token=abc; Path=/")
    getSession.mockResolvedValue({
      headers,
      response: { user: { banned: false }, session: {} },
    })
    expect((await getFreshSession(new Headers())).setCookies).toEqual([
      "mk.session_token=abc; Path=/",
    ])
  })
})

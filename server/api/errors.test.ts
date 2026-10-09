import { HTTPException } from "hono/http-exception"
import { Hono } from "hono"
import { requestId } from "hono/request-id"
import { describe, expect, it, vi } from "vitest"

import { handleError } from "@/server/api/errors"

const make = (status: 400 | 405 | 415 | 422 | 500 | 502) => {
  const app = new Hono().use(requestId()).get("/", () => {
    throw new HTTPException(status, { message: "secret detail" })
  })
  app.onError(handleError)
  return app
}

describe("handleError with HTTPException", () => {
  it.each([405, 415, 422] as const)(
    "keeps %i as a client error, never INTERNAL",
    async (status) => {
      const response = await make(status).request("/")
      expect(response.status).toBe(status)
      const body = await response.json()
      expect(body.error.code).toBe("BAD_REQUEST")
      expect(body.error.requestId).toEqual(expect.any(String))
    }
  )

  it.each([500, 502] as const)("hides the message for %i", async (status) => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const response = await make(status).request("/")
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toMatchObject({
      code: "INTERNAL",
      message: "Something went wrong",
    })
  })
})

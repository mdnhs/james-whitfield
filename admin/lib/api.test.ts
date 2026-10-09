import { Hono } from "hono"
import { hc } from "hono/client"
import { describe, expect, it } from "vitest"

import { parseResponse } from "./api"
import { ApiError } from "./api-error"

// Stands in for the API: same envelope (docs/brief.md §8.2), no database.
const fake = new Hono()
  .get("/ok", (c) => c.json({ hello: "world" }))
  .get("/forbidden", (c) =>
    c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You don't have permission to do that",
          requestId: "r1",
        },
      },
      403
    )
  )
  .post("/invalid", (c) =>
    c.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "Some fields need attention",
          requestId: "r2",
          fieldErrors: { email: ["Enter a valid email"] },
        },
      },
      400
    )
  )
  .get("/gateway", (c) => c.html("<h1>Bad gateway</h1>", 502))

const client = hc<typeof fake>("http://test", { fetch: fake.request })

describe("parseResponse", () => {
  it("returns typed data on success", async () => {
    const data = await parseResponse(client.ok.$get())
    expect(data.hello).toBe("world")
  })

  it("turns the error envelope into an ApiError", async () => {
    const error = await parseResponse(client.forbidden.$get()).catch(
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      code: "FORBIDDEN",
      status: 403,
      requestId: "r1",
      message: "You don't have permission to do that",
    })
  })

  it("keeps field errors for forms", async () => {
    const error = await parseResponse(client.invalid.$post()).catch(
      (e: unknown) => e
    )
    expect(error).toMatchObject({
      code: "VALIDATION_FAILED",
      fieldErrors: { email: ["Enter a valid email"] },
    })
  })

  it("maps a non-JSON 5xx to INTERNAL", async () => {
    const error = await parseResponse(client.gateway.$get()).catch(
      (e: unknown) => e
    )
    expect(error).toMatchObject({ code: "INTERNAL", status: 502 })
  })

  it("maps a request that never got an answer to NETWORK", async () => {
    const error = await parseResponse(
      Promise.reject(new TypeError("fetch failed"))
    ).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: "NETWORK", status: 0 })
  })
})

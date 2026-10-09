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
  .get("/proxy401", (c) => c.html("<h1>Login</h1>", 401))
  .get("/proxy404", (c) => c.html("<h1>Missing</h1>", 404))
  .get("/proxy429", (c) => c.text("slow down", 429))
  .get("/proxy503", (c) => c.html("<h1>Down</h1>", 503))
  .get("/unknown", (c) =>
    c.json({ error: { code: "WAT", message: "x", fieldErrors: 5 } }, 403)
  )
  .get(
    "/badjson",
    () =>
      new Response("{nope", {
        status: 502,
        headers: { "content-type": "application/json" },
      })
  )
  .get(
    "/badjson200",
    () =>
      new Response("{nope", {
        status: 200,
        headers: { "content-type": "application/json" },
      })
  )

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

  it.each([
    ["proxy401", "UNAUTHENTICATED", 401],
    ["proxy404", "NOT_FOUND", 404],
    ["proxy429", "RATE_LIMITED", 429],
    ["proxy503", "UNAVAILABLE", 503],
    ["unknown", "FORBIDDEN", 403],
    ["badjson", "INTERNAL", 502],
    ["badjson200", "BAD_REQUEST", 200],
  ] as const)(
    "falls back to a status-based code for %s",
    async (path, code, status) => {
      const error = await parseResponse(
        (client as never as Record<string, { $get(): Promise<never> }>)[
          path
        ].$get()
      ).catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ApiError)
      expect(error).toMatchObject({ code, status, fieldErrors: {} })
    }
  )

  it("rethrows an aborted request untouched", async () => {
    const abort = new DOMException("aborted", "AbortError")
    const error = await parseResponse(Promise.reject(abort)).catch(
      (e: unknown) => e
    )
    expect(error).toBe(abort)
  })

  it("does not call a non-fetch failure a network error", async () => {
    const error = await parseResponse(Promise.reject(new Error("boom"))).catch(
      (e: unknown) => e
    )
    expect(error).toMatchObject({ code: "INTERNAL", status: 0 })
  })
})

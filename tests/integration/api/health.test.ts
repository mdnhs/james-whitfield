import { afterAll, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { closeDb } from "@/server/db/client"

afterAll(closeDb)

describe("api core", () => {
  it("reports a healthy database", async () => {
    const response = await app.request("/api/v1/health")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok", db: "ok" })
  })

  it("returns the error envelope for unknown routes", async () => {
    const response = await app.request("/api/v1/nope")
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toMatchObject({ code: "NOT_FOUND" })
    expect(body.error.requestId).toEqual(expect.any(String))
  })

  it("sets security headers", async () => {
    const response = await app.request("/api/v1/health")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  })

  it("marks every response noindex, errors included", async () => {
    const ok = await app.request("/api/v1/health")
    const missing = await app.request("/api/v1/nope")
    expect(ok.headers.get("x-robots-tag")).toBe("noindex")
    expect(missing.headers.get("x-robots-tag")).toBe("noindex")
  })

  it("rejects admin bodies over 1 MB with the envelope", async () => {
    const response = await app.request("/api/v1/admin/anything", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ blob: "x".repeat(1024 * 1024 + 1) }),
    })
    expect(response.status).toBe(413)
    expect(response.headers.get("x-robots-tag")).toBe("noindex")
    const body = await response.json()
    expect(body.error).toMatchObject({ code: "PAYLOAD_TOO_LARGE" })
    expect(body.error.requestId).toEqual(expect.any(String))
  })

  it("lets small admin bodies through to routing", async () => {
    const response = await app.request("/api/v1/admin/__nope", {
      method: "POST",
      body: "{}",
    })
    expect(response.status).toBe(404)
  })
})

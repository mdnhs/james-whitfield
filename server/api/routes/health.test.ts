import { describe, expect, it, vi } from "vitest"

vi.mock("@/server/db/client", () => ({
  getDb: () => ({
    execute: () => Promise.reject(new Error("connect ECONNREFUSED")),
  }),
}))

const { app } = await import("@/server/api/app")

describe("GET /api/v1/health when the database is down", () => {
  it("answers 503 with the error envelope instead of crashing", async () => {
    const response = await app.request("/api/v1/health")
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error.code).toBe("UNAVAILABLE")
    expect(body.error.requestId).toEqual(expect.any(String))
  })
})

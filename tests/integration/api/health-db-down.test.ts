import { afterAll, describe, expect, it } from "vitest"

// Nothing listens on port 1; set before the lazy pool is first created.
process.env.DATABASE_URL = "postgres://mk:mk@127.0.0.1:1/mk_test"

const { app } = await import("@/server/api/app")
const { closeDb } = await import("@/server/db/client")

afterAll(closeDb)

describe("GET /api/v1/health with an unreachable DATABASE_URL", () => {
  it("answers the 503 envelope rather than throwing", async () => {
    const response = await app.request("/api/v1/health")
    expect(response.status).toBe(503)
    expect(response.headers.get("x-robots-tag")).toBe("noindex")
    const body = await response.json()
    expect(body.error).toMatchObject({ code: "UNAVAILABLE" })
    expect(body.error.requestId).toEqual(expect.any(String))
  })
})

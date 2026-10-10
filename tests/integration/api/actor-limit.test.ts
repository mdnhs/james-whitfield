import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import { closeDb } from "@/server/db/client"
import { clearOutbox } from "@/server/lib/email"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterEach(clearOutbox)
afterAll(closeDb)

describe("per-user limits (Ruling R16)", () => {
  it("allows 20 invites an hour, then 429 with Retry-After", async () => {
    const cookie = await cookieFor("owner")
    for (let i = 0; i < 20; i++) {
      const r = await adminRequest("/users/invite", cookie, {
        method: "POST",
        body: { email: `p${i}@example.com`, name: `P${i}`, role: "viewer" },
      })
      expect(r.status, `invite ${i}`).toBe(201)
    }
    const over = await adminRequest("/users/invite", cookie, {
      method: "POST",
      body: { email: "p20@example.com", name: "P20", role: "viewer" },
    })
    expect(over.status).toBe(429)
    expect(Number(over.headers.get("retry-after"))).toBeGreaterThan(0)
    expect((await over.json()).error.code).toBe("RATE_LIMITED")
  })

  it("counts each person separately", async () => {
    const a = await cookieFor("owner", "a@example.com")
    const b = await cookieFor("admin", "b@example.com")
    for (let i = 0; i < 10; i++) await adminRequest("/audit/export.csv", a)
    expect((await adminRequest("/audit/export.csv", a)).status).toBe(429)
    expect((await adminRequest("/audit/export.csv", b)).status).toBe(200)
  })

  it("never limits a request it refuses first", async () => {
    const viewer = await cookieFor("viewer")
    for (let i = 0; i < 15; i++)
      expect((await adminRequest("/audit/export.csv", viewer)).status).toBe(403)
  })
})

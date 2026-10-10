import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb } from "@/server/db/client"
import { hitLimit } from "@/server/lib/rate-limit-db"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)
const opts = { limit: 5, windowMs: 600_000 }

describe("Postgres fixed-window limiter", () => {
  it("allows five per window, then reports Retry-After, then resets", async () => {
    const t0 = new Date("2026-10-10T10:00:00Z")
    for (let i = 0; i < 5; i++)
      expect((await hitLimit("k", opts, t0)).allowed).toBe(true)
    const blocked = await hitLimit("k", opts, new Date(t0.getTime() + 60_000))
    expect(blocked).toEqual({ allowed: false, retryAfterSec: 540 })
    expect(
      (await hitLimit("k", opts, new Date(t0.getTime() + 600_000))).allowed
    ).toBe(true)
  })

  it("is atomic under concurrency", async () => {
    const now = new Date()
    const results = await Promise.all(
      Array.from({ length: 10 }, () => hitLimit("race", opts, now))
    )
    expect(results.filter((r) => r.allowed)).toHaveLength(5)
  })

  it("keeps keys apart", async () => {
    for (let i = 0; i < 5; i++) await hitLimit("a", opts)
    expect((await hitLimit("b", opts)).allowed).toBe(true)
  })
})

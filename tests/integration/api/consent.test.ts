import { createHash } from "node:crypto"

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: vi.fn(),
}))

import { closeDb, getDb } from "@/server/db/client"
import { consentEvents, settings } from "@/server/db/schema"

import { resetDb } from "../helpers/db"
import { freshIp, publicRequest } from "../helpers/leads"

const ID = "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc"
const body = (over: Record<string, unknown> = {}) => ({
  id: ID,
  v: 1,
  a: true,
  m: false,
  action: "custom",
  ...over,
})

beforeEach(async () => {
  await resetDb()
  await getDb()
    .insert(settings)
    .values({
      key: "consent",
      value: { title: "Cookies", body: "We use cookies." },
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: { title: "Cookies", body: "We use cookies." } },
    })
})
afterAll(closeDb)

describe("POST /public/consent", () => {
  it("stores the choice with a server-computed banner hash and no IP", async () => {
    const res = await publicRequest("/consent", {
      method: "POST",
      body: body(),
    })
    expect(res.status).toBe(204)
    const rows = await getDb().select().from(consentEvents)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      consentId: ID,
      analytics: true,
      marketing: false,
      revision: 1,
      action: "custom",
    })
    expect(rows[0]!.bannerHash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(rows[0])).not.toMatch(/198\.51\.100/)
  })

  it("ignores any hash the client sends", async () => {
    await publicRequest("/consent", {
      method: "POST",
      body: body({ bannerHash: "f".repeat(64) }),
    })
    const [row] = await getDb().select().from(consentEvents)
    expect(row!.bannerHash).not.toBe("f".repeat(64))
  })

  it("changes the hash when the banner copy changes", async () => {
    await publicRequest("/consent", { method: "POST", body: body() })
    await getDb()
      .update(settings)
      .set({ value: { title: "Cookies v2" } })
    await publicRequest("/consent", { method: "POST", body: body() })
    const rows = await getDb().select().from(consentEvents)
    expect(new Set(rows.map((r) => r.bannerHash)).size).toBe(2)
  })

  it.each([
    [{ id: "nope" }],
    [{ action: "maybe" }],
    [{ v: 0 }],
    [{ a: "yes" }],
  ])("answers 400 for %j", async (over) => {
    const res = await publicRequest("/consent", {
      method: "POST",
      body: body(over),
    })
    expect(res.status).toBe(400)
    expect(await getDb().select().from(consentEvents)).toHaveLength(0)
  })

  it("rate-limits per client (20 per 10 minutes)", async () => {
    const ip = freshIp()
    for (let i = 0; i < 20; i++) {
      const ok = await publicRequest("/consent", {
        method: "POST",
        body: body(),
        ip,
      })
      expect(ok.status).toBe(204)
    }
    const res = await publicRequest("/consent", {
      method: "POST",
      body: body(),
      ip,
    })
    expect(res.status).toBe(429)
  })

  it("is append-only: the service exposes no update or delete", async () => {
    const mod = await import("@/server/modules/consent/service")
    expect(Object.keys(mod).sort()).toEqual(
      ["CONSENT_LIMIT", "bannerHash", "recordConsent"].sort()
    )
  })

  it("hashes exactly the copy a visitor sees", async () => {
    const { bannerHash } = await import("@/server/modules/consent/service")
    const { ConsentGlobal } = await import("@/lib/content/globals")
    const copy = ConsentGlobal.parse({ title: "Cookies" })
    const expected = createHash("sha256")
      .update(
        JSON.stringify(["Cookies", "", "", "", "", "", "", "", "", "", ""])
      )
      .digest("hex")
    expect(bannerHash(copy)).toBe(expected)
    // Changing the revision alone does not change what was shown.
    expect(bannerHash({ ...copy, version: 9 })).toBe(expected)
  })
})

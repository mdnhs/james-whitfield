import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { eq } from "drizzle-orm"

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, settings } from "@/server/db/schema"
import { resetEnvForTests } from "@/server/env"
import { audit } from "@/server/lib/audit"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

const TOKEN = "EAAB-test-token-0123456789-abcdefghij"
const value = (over: Record<string, unknown> = {}) => ({
  gtmId: "GTM-AB12CD3",
  ga4Id: "G-XYZ123",
  metaPixelId: "1234567890",
  testEventCode: "TEST123",
  enabled: { gtm: true, ga4: true, meta: true, capi: true },
  ...over,
})
const put = (cookie: string, body: object) =>
  adminRequest("/tracking", cookie, { method: "PUT", body })
const KEY = process.env.APP_ENCRYPTION_KEY

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockClear()
})
afterEach(() => {
  process.env.APP_ENCRYPTION_KEY = KEY
  resetEnvForTests()
})
afterAll(closeDb)

describe("tracking permissions (brief §7.2)", () => {
  const allowed: RoleName[] = ["owner", "admin", "marketer"]
  it.each(ROLE_NAMES)("GET /tracking as %s", async (role) => {
    const res = await adminRequest("/tracking", await cookieFor(role))
    expect(res.status).toBe(allowed.includes(role) ? 200 : 403)
  })
})

describe("PUT /tracking", () => {
  it("encrypts the token and never returns or logs it", async () => {
    const cookie = await cookieFor("marketer")
    const res = await put(cookie, {
      version: 0,
      value: value(),
      capiToken: TOKEN,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.capiToken).toEqual({ configured: true, readable: true })
    expect(body.value).not.toHaveProperty("capiTokenEncrypted")
    expect(JSON.stringify(body)).not.toContain(TOKEN)
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "tracking"))
    expect(JSON.stringify(row!.value)).not.toContain(TOKEN)
    expect(
      (row!.value as { capiTokenEncrypted: string }).capiTokenEncrypted
    ).toMatch(/^v1\./)
    const logs = await getDb().select().from(auditLogs)
    expect(JSON.stringify(logs)).not.toContain(TOKEN)
    expect(
      logs.find((l) => l.action === "tracking.update")!.diff
    ).toMatchObject({
      capiToken: { from: "none", to: "replaced" },
    })
    expect(next.revalidateTag).toHaveBeenCalledWith("settings:tracking", {
      expire: 0,
    })
  })

  it("keeps the token when omitted and removes it on null", async () => {
    const cookie = await cookieFor("admin")
    await put(cookie, { version: 0, value: value(), capiToken: TOKEN })
    const kept = await (
      await put(cookie, { version: 1, value: value() })
    ).json()
    expect(kept.capiToken.configured).toBe(true)
    const removed = await (
      await put(cookie, { version: 2, value: value(), capiToken: null })
    ).json()
    expect(removed.capiToken).toEqual({ configured: false, readable: null })
    expect(removed.status.capi).toBe("no-token")
  })

  it("rejects malformed IDs with field errors", async () => {
    const res = await put(await cookieFor("marketer"), {
      version: 0,
      value: value({ gtmId: "gtm-abc", metaPixelId: "12" }),
    })
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(Object.keys(error.fieldErrors)).toEqual(
      expect.arrayContaining(["gtmId", "metaPixelId"])
    )
  })

  it("explains a missing key instead of failing", async () => {
    delete process.env.APP_ENCRYPTION_KEY
    resetEnvForTests()
    const res = await put(await cookieFor("marketer"), {
      version: 0,
      value: value(),
      capiToken: TOKEN,
    })
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.fieldErrors.capiToken[0]).toMatch(/APP_ENCRYPTION_KEY/)
    const status = await (
      await adminRequest("/tracking", await cookieFor("owner"))
    ).json()
    expect(status.keyAvailable).toBe(false)
  })

  it("reports an unreadable token", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "tracking",
        value: { ...value(), capiTokenEncrypted: "v1.aaaa.bbbb.cccc" },
      })
    const body = await (
      await adminRequest("/tracking", await cookieFor("marketer"))
    ).json()
    expect(body.capiToken).toEqual({ configured: true, readable: false })
    expect(body.status.capi).toBe("unreadable-token")
  })

  it("answers 409 on a stale version", async () => {
    const cookie = await cookieFor("marketer")
    await put(cookie, { version: 0, value: value() })
    expect((await put(cookie, { version: 0, value: value() })).status).toBe(409)
  })
})

describe("status", () => {
  it("explains what blocks each channel", async () => {
    const cookie = await cookieFor("marketer")
    const body = await (
      await put(cookie, {
        version: 0,
        value: value({
          gtmId: "",
          enabled: { gtm: true, ga4: true, meta: true, capi: false },
        }),
      })
    ).json()
    // The consent banner is off by default.
    expect(body.status).toEqual({
      gtm: "missing-id",
      ga4: "needs-gtm",
      meta: "needs-banner",
      capi: "off",
    })
  })

  it("shows the latest CAPI failure", async () => {
    await audit(null, {
      action: "tracking.capi_failed",
      entityType: "setting",
      entityId: "tracking",
      summary: "Meta Conversions API did not accept a Lead event (HTTP 400)",
    })
    const body = await (
      await adminRequest("/tracking", await cookieFor("marketer"))
    ).json()
    expect(body.lastCapiFailure.summary).toContain("HTTP 400")
  })
})

describe("enhanced matching (Ruling R12)", () => {
  it("only an owner may change it, and only with the acknowledgement", async () => {
    const marketer = await cookieFor("marketer")
    expect(
      (
        await put(marketer, {
          version: 0,
          value: value(),
          enhancedMatching: { enabled: true, acknowledge: true },
        })
      ).status
    ).toBe(403)
    const owner = await cookieFor("owner")
    const missing = await put(owner, {
      version: 0,
      value: value(),
      enhancedMatching: { enabled: true },
    })
    expect(missing.status).toBe(400)
    expect((await missing.json()).error.fieldErrors).toHaveProperty(
      "enhancedMatching.acknowledge"
    )
    const ok = await put(owner, {
      version: 0,
      value: value(),
      enhancedMatching: { enabled: true, acknowledge: true },
    })
    expect(ok.status).toBe(200)
    expect((await ok.json()).value.enhancedMatching).toMatchObject({
      enabled: true,
      acknowledgedBy: "owner@example.com",
    })
    const [entry] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "tracking.enhanced_matching"))
    expect(entry!.summary).toMatch(/acknowledged/i)
  })

  it("a marketer can still save other fields while it is on", async () => {
    const owner = await cookieFor("owner")
    await put(owner, {
      version: 0,
      value: value(),
      enhancedMatching: { enabled: true, acknowledge: true },
    })
    const res = await put(await cookieFor("marketer"), {
      version: 1,
      value: value({ testEventCode: "OTHER1" }),
    })
    expect(res.status).toBe(200)
    expect((await res.json()).value.enhancedMatching.enabled).toBe(true)
  })
})

describe("POST /tracking/test-capi", () => {
  it("sends one test event with the test code", async () => {
    const cookie = await cookieFor("marketer")
    await put(cookie, { version: 0, value: value(), capiToken: TOKEN })
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response('{"events_received":1}', { status: 200 }))
    const res = await adminRequest("/tracking/test-capi", cookie, {
      method: "POST",
    })
    expect(await res.json()).toEqual({
      ok: true,
      status: 200,
      message: "Meta received the test event",
    })
    const sent = JSON.parse(String((spy.mock.calls[0]![1] as RequestInit).body))
    expect(sent.test_event_code).toBe("TEST123")
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it("answers 400 when the test code or token is missing", async () => {
    const cookie = await cookieFor("marketer")
    await put(cookie, { version: 0, value: value({ testEventCode: "" }) })
    const res = await adminRequest("/tracking/test-capi", cookie, {
      method: "POST",
    })
    expect(res.status).toBe(400)
    expect(Object.keys((await res.json()).error.fieldErrors)).toEqual(
      expect.arrayContaining(["testEventCode", "capiToken"])
    )
  })
})

describe("test event guards", () => {
  it("is refused to roles without tracking.update", async () => {
    for (const role of ["editor", "author"] as const) {
      const res = await adminRequest(
        "/tracking/test-capi",
        await cookieFor(role),
        { method: "POST" }
      )
      expect(res.status).toBe(403)
    }
  })

  it("is rate limited per user", async () => {
    const cookie = await cookieFor("marketer")
    const statuses: number[] = []
    for (let i = 0; i < 7; i++) {
      const res = await adminRequest("/tracking/test-capi", cookie, {
        method: "POST",
      })
      statuses.push(res.status)
    }
    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400])
    expect(statuses.slice(5)).toEqual([429, 429])
  })

  it("never returns the token on GET", async () => {
    const cookie = await cookieFor("owner")
    await put(cookie, { version: 0, value: value(), capiToken: TOKEN })
    const res = await adminRequest("/tracking", cookie)
    const text = await res.text()
    expect(text).not.toContain(TOKEN)
    expect(text).not.toContain("capiTokenEncrypted")
    expect(text).not.toContain("v1.")
  })
})

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: vi.fn(),
}))
const deferred = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    deferred.tasks.push(Promise.resolve().then(task))
  },
}))
const drain = async () => {
  await Promise.allSettled(deferred.tasks.splice(0))
}

import { eq } from "drizzle-orm"

import { encodeConsent } from "@/lib/tracking/consent"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, leads, settings } from "@/server/db/schema"
import { CAPI_TOKEN_PURPOSE, encryptSecret } from "@/server/lib/secrets"
import { sha256 } from "@/server/lib/meta-capi"

import { insertServiceAndForm } from "../helpers/content"
import { resetDb } from "../helpers/db"
import { publicRequest, submission } from "../helpers/leads"

const CONSENT = {
  enabled: true,
  title: "t",
  body: "b",
  accept: "a",
  reject: "r",
  customise: "c",
  save: "s",
  settingsLink: "l",
  version: 1,
}
const put = (key: string, value: unknown) =>
  getDb()
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
const tracking = (over: Record<string, unknown> = {}) => ({
  metaPixelId: "1234567890",
  capiTokenEncrypted: encryptSecret("EAAB-token", CAPI_TOKEN_PURPOSE),
  enabled: { meta: true, capi: true },
  ...over,
})
const cookie = (a: 0 | 1, m: 0 | 1, v = 1) =>
  `mk_consent=${encodeConsent({
    id: "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
    v,
    ts: Math.floor(Date.now() / 1000) - 60,
    a,
    m,
  })}; _fbp=fb.1.1700000000000.42; _fbc=fb.1.1700000000000.IwAR0`

let fetchSpy: MockInstance<typeof fetch>
beforeEach(async () => {
  await resetDb()
  await insertServiceAndForm()
  await put("consent", CONSENT)
  await put("tracking", tracking())
  fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response('{"events_received":1}', { status: 200 }))
})
afterEach(() => fetchSpy.mockRestore())
afterAll(closeDb)

const post = (body: object, cookieHeader?: string) =>
  publicRequest("/leads", { method: "POST", body, cookie: cookieHeader })
const capiCalls = () =>
  fetchSpy.mock.calls.filter(([url]) =>
    String(url).startsWith("https://graph.facebook.com/")
  )

describe("CAPI on an accepted enquiry (brief §12.5, Ruling R9)", () => {
  it("sends Lead with the browser's event_id when cookie and flag agree", async () => {
    const body = submission({ marketingConsent: true })
    expect((await post(body, cookie(1, 1))).status).toBe(201)
    await drain()
    const calls = capiCalls()
    expect(calls).toHaveLength(1)
    expect(String(calls[0]![0])).toBe(
      "https://graph.facebook.com/v26.0/1234567890/events"
    )
    const sent = JSON.parse(String((calls[0]![1] as RequestInit).body))
    const [row] = await getDb().select().from(leads)
    expect(sent.data[0]).toMatchObject({
      event_name: "Lead",
      event_id: body.eventId,
      event_source_url: "http://localhost:3000/contact",
      user_data: {
        fbp: "fb.1.1700000000000.42",
        fbc: "fb.1.1700000000000.IwAR0",
        external_id: [sha256(row!.id)],
        client_user_agent: "vitest",
      },
    })
    expect(sent.data[0].user_data).not.toHaveProperty("em")
    expect(row).toMatchObject({
      marketingConsent: true,
      metaEventId: body.eventId,
      consent: expect.objectContaining({
        analytics: true,
        marketing: true,
        version: 1,
      }),
    })
  })

  it.each([
    ["the browser flag is false", { marketingConsent: false }, cookie(1, 1)],
    ["there is no cookie", { marketingConsent: true }, undefined],
    ["the cookie denies marketing", { marketingConsent: true }, cookie(1, 0)],
    ["a stale cookie", { marketingConsent: true }, cookie(1, 1, 2)],
  ])("sends nothing to Meta when %s", async (_label, over, header) => {
    expect((await post(submission(over), header)).status).toBe(201)
    await drain()
    expect(capiCalls()).toHaveLength(0)
  })

  it("sends nothing when the banner is off or CAPI is disabled", async () => {
    await put("consent", { ...CONSENT, enabled: false })
    await post(submission({ marketingConsent: true }), cookie(1, 1))
    await put("consent", CONSENT)
    await put("tracking", tracking({ enabled: { meta: true, capi: false } }))
    await post(submission({ marketingConsent: true }), cookie(1, 1))
    await drain()
    expect(capiCalls()).toHaveLength(0)
    // Banner off → not recorded as consent; CAPI off → consent recorded, no call.
    const rows = await getDb().select().from(leads)
    expect(rows.map((r) => r.marketingConsent).sort()).toEqual([false, true])
  })

  it("adds hashed em and ph once enhanced matching is acknowledged", async () => {
    await put(
      "tracking",
      tracking({
        enhancedMatching: {
          enabled: true,
          acknowledgedAt: "2026-10-01T00:00:00.000Z",
          acknowledgedBy: "owner@example.com",
        },
      })
    )
    const body = submission({ marketingConsent: true })
    await post(body, cookie(1, 1))
    await drain()
    const sent = JSON.parse(String((capiCalls()[0]![1] as RequestInit).body))
    expect(sent.data[0].user_data.em).toEqual([sha256(body.email)])
    expect(sent.data[0].user_data.ph).toEqual([sha256("353871234567")])
  })

  it("skips CAPI when the token cannot be decrypted", async () => {
    await put("tracking", tracking({ capiTokenEncrypted: "v1.bad.bad.bad" }))
    expect(
      (await post(submission({ marketingConsent: true }), cookie(1, 1))).status
    ).toBe(201)
    await drain()
    expect(capiCalls()).toHaveLength(0)
  })

  it("audits a failed delivery without the token or payload", async () => {
    fetchSpy.mockResolvedValue(
      new Response('{"error":{"message":"Invalid parameter"}}', { status: 400 })
    )
    await post(submission({ marketingConsent: true }), cookie(1, 1))
    await drain()
    const rows = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "tracking.capi_failed"))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.summary).toContain("400")
    expect(JSON.stringify(rows[0])).not.toMatch(/EAAB|example\.com|fbp/)
  })

  it("never sends spam to Meta", async () => {
    await post(
      submission({ marketingConsent: true, website: "bot" }),
      cookie(1, 1)
    )
    await drain()
    expect(capiCalls()).toHaveLength(0)
  })

  it("never sends a newsletter-page enquiry to Meta", async () => {
    await post(
      submission({ marketingConsent: true, sourcePath: "/newsletter/confirm" }),
      cookie(1, 1)
    )
    await drain()
    expect(capiCalls()).toHaveLength(0)
  })

  it("keeps the lead response when Meta cannot be reached", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"))
    expect(
      (await post(submission({ marketingConsent: true }), cookie(1, 1))).status
    ).toBe(201)
    await drain() // real 1 s + 4 s backoff
    const rows = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "tracking.capi_failed"))
    expect(rows.map((r) => r.summary)).toEqual([
      "Meta Conversions API did not accept a Lead event (no answer)",
    ])
  }, 15_000)
})

import { eq } from "drizzle-orm"
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

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, leadActivities, leads, settings } from "@/server/db/schema"
import { resetEnvForTests } from "@/server/env"
import * as email from "@/server/lib/email"
import { clearOutbox, readOutbox } from "@/server/lib/email"
import { issueStamp } from "@/server/modules/leads/stamp"

import { cookieFor } from "../helpers/auth"
import { insertServiceAndForm } from "../helpers/content"
import { freshIp, publicRequest, submission } from "../helpers/leads"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  clearOutbox()
  // Services "anxiety" + contactForm formats ["Online"] + contact.email
  // "practice@example.com": the helper writes the collection row and globals.
  await insertServiceAndForm()
})
afterAll(closeDb)
const post = (body: unknown, ip = freshIp()) =>
  publicRequest("/leads", { method: "POST", body, ip })

describe("POST /public/leads", () => {
  it("stores a valid enquiry with attribution and returns 201 { ok: true }", async () => {
    const body = submission()
    const res = await post(body)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
    const [row] = await getDb().select().from(leads)
    expect(row).toMatchObject({
      status: "new",
      email: body.email,
      phone: "+353871234567",
      topicSlug: "anxiety",
      formatSlug: "online",
      sourcePath: "/contact",
      referrer: "https://google.com/",
      utm: { utm_source: "google" },
      metaEventId: body.eventId,
      marketingConsent: false,
    })
    expect(row!.ipHash).toMatch(/^[0-9a-f]{32}$/)
    expect(row!.privacyConsentAt).toBeInstanceOf(Date)
    expect(row!.consent.privacyText).toBeTruthy()
  })

  it("answers field errors, including unknown topics and impossible phones", async () => {
    const res = await post(
      submission({ email: "nope", topic: "made-up", phone: "123456" })
    )
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(Object.keys(error.fieldErrors).sort()).toEqual(["email"])
    const second = await post(submission({ topic: "made-up", phone: "123456" }))
    expect(Object.keys((await second.json()).error.fieldErrors).sort()).toEqual(
      ["phone", "topic"]
    )
  })

  it("spam is indistinguishable: honeypot, fast fill and bad stamp", async () => {
    const real = await post(submission())
    for (const extra of [
      { website: "https://spam.example" },
      { stamp: issueStamp(Date.now() - 500) },
      { stamp: "forged.stamp" },
    ]) {
      const res = await post(submission(extra))
      expect(res.status).toBe(real.status)
      expect(await res.json()).toEqual({ ok: true })
    }
    await drain()
    const rows = await getDb()
      .select()
      .from(leads)
      .where(eq(leads.status, "spam"))
    expect(rows.map((r) => r.spamReason).sort()).toEqual([
      "honeypot",
      "stamp",
      "too-fast",
    ])
    // Only the real one notified the practice.
    expect(
      readOutbox().filter((m) => m.subject.startsWith("New enquiry"))
    ).toHaveLength(1)
  })

  it("stores even malformed spam, capped", async () => {
    const res = await post({ website: "x", name: "y".repeat(5000), email: 42 })
    expect(res.status).toBe(201)
    const [row] = await getDb().select().from(leads)
    expect(row).toMatchObject({ status: "spam", email: "" })
    expect(row!.name.length).toBeLessThanOrEqual(120)
  })

  it("limits 5 per 10 minutes per IP, and separately per email", async () => {
    const ip = freshIp()
    for (let i = 0; i < 5; i++)
      expect((await post(submission(), ip)).status).toBe(201)
    const blocked = await post(submission(), ip)
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get("retry-after")).toMatch(/^\d+$/)
    expect((await blocked.json()).error.code).toBe("RATE_LIMITED")
    const same = submission().email
    for (let i = 0; i < 5; i++) await post(submission({ email: same }))
    expect((await post(submission({ email: same }))).status).toBe(429)
  })

  it("privacy by default: no message in the notification, auto-reply never echoes it", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "notifications",
        value: {
          recipients: ["owner@example.com"],
          autoReply: { enabled: true, subject: "Thanks", body: "Hi {name}" },
        },
      })
    await post(submission())
    await drain()
    const out = readOutbox()
    const notify = out.find((m) => m.subject.startsWith("New enquiry"))!
    expect([notify.to].flat()).toEqual(["owner@example.com"])
    expect(notify.subject).toBe("New enquiry from Ann Example")
    expect(`${notify.html}${notify.text}`).not.toContain("SECRET-MESSAGE")
    expect(notify.text).toMatch(/\/admin\/leads\?lead=[0-9a-f-]{36}/)
    const reply = out.find((m) => m.subject === "Thanks")!
    expect(`${reply.html}${reply.text}`).not.toContain("SECRET-MESSAGE")
    expect(reply.text).toContain("Hi Ann Example")
  })

  it("includes the message when the owner switched it on", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "notifications", value: { includeMessage: true } })
    await post(submission())
    await drain()
    expect(readOutbox()[0]!.text).toContain("SECRET-MESSAGE")
  })

  it("a failed notification keeps the lead, logs an email activity and alerts owners", async () => {
    await cookieFor("owner") // creates owner@example.com
    const real = email.sendEmail
    vi.spyOn(email, "sendEmail").mockImplementation(async (m) => {
      if (m.subject.startsWith("New enquiry"))
        throw new email.EmailError("smtp_error", "down")
      return real(m)
    })
    expect((await post(submission())).status).toBe(201)
    await drain()
    const [activity] = await getDb().select().from(leadActivities)
    expect(activity).toMatchObject({
      type: "email",
      data: { kind: "notification", status: "failed", error: "smtp_error" },
    })
    expect(
      readOutbox().some((m) => [m.to].flat().includes("owner@example.com"))
    ).toBe(true)
    vi.restoreAllMocks()
  })

  it("writes no audit row and never logs the message", async () => {
    await post(submission())
    expect(
      JSON.stringify(await getDb().select().from(auditLogs))
    ).not.toContain("SECRET-MESSAGE")
  })

  it("issues a fresh stamp with no-store", async () => {
    const res = await publicRequest("/leads/stamp")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect((await res.json()).stamp).toMatch(/^\d{13}\.[0-9a-f]{32}$/)
  })

  it("refuses bodies over 64 KB", async () => {
    const res = await post(submission({ message: "x".repeat(70_000) }))
    expect(res.status).toBe(413)
  })
})

describe("POST /public/leads mail headers", () => {
  it("strips line breaks from the visitor's name in the subject", async () => {
    await post(submission({ name: "Ann\r\nBcc: evil@example.com" }))
    await drain()
    const notify = readOutbox().find((m) =>
      m.subject.startsWith("New enquiry")
    )!
    expect(notify.subject).toBe("New enquiry from Ann Bcc: evil@example.com")
    expect(notify.replyTo).toMatch(/^ann\+[0-9a-f]{8}@example\.com$/)
  })
})

// Ruling R17: an explicit "no" from siteverify is spam (same 201); an
// unreachable siteverify lets the lead in, flagged for the admin.
describe("POST /public/leads with Turnstile", () => {
  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "1x00000000000000000000AA")
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA")
    resetEnvForTests()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    resetEnvForTests()
  })
  const siteverify = (impl: () => Promise<Response>) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(impl)
  const answer = (body: object) => () =>
    Promise.resolve(new Response(JSON.stringify(body)))
  const turnstilePost = () => post(submission({ turnstileToken: "tok" }))

  it("accepts a verified token", async () => {
    siteverify(answer({ success: true, action: "lead", hostname: "localhost" }))
    expect((await turnstilePost()).status).toBe(201)
    const [row] = await getDb().select().from(leads)
    expect(row).toMatchObject({ status: "new", turnstileUnverified: false })
  })

  it.each([
    [
      "an explicit failure",
      { success: false, "error-codes": ["invalid-input-response"] },
    ],
    [
      "a hostname mismatch",
      { success: true, action: "lead", hostname: "evil.example" },
    ],
    [
      "an action mismatch",
      { success: true, action: "login", hostname: "localhost" },
    ],
  ])("treats %s as spam with the same answer", async (_label, body) => {
    siteverify(answer(body))
    const res = await turnstilePost()
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
    await drain()
    const [row] = await getDb().select().from(leads)
    expect(row).toMatchObject({ status: "spam", spamReason: "turnstile" })
    expect(readOutbox()).toHaveLength(0)
  })

  it("fails open when siteverify is unreachable, flagging the lead", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    siteverify(() => Promise.reject(new TypeError("fetch failed")))
    const res = await turnstilePost()
    expect(res.status).toBe(201)
    await drain()
    const [row] = await getDb().select().from(leads)
    expect(row).toMatchObject({ status: "new", turnstileUnverified: true })
    const activities = await getDb()
      .select()
      .from(leadActivities)
      .where(eq(leadActivities.leadId, row!.id))
    expect(activities).toContainEqual(
      expect.objectContaining({
        type: "note",
        data: { kind: "turnstile-unverified" },
      })
    )
    expect(readOutbox().some((m) => m.subject.startsWith("New enquiry"))).toBe(
      true
    )
  })
})

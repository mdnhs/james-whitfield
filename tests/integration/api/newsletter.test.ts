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

import { app } from "@/server/api/app"
import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { newsletterSubscribers, settings } from "@/server/db/schema"
import { clearOutbox, readOutbox } from "@/server/lib/email"
import { unsubscribeToken } from "@/server/modules/newsletter/service"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"
import { publicRequest } from "../helpers/leads"

beforeEach(async () => {
  await resetDb()
  clearOutbox()
})
afterEach(() => vi.useRealTimers())
afterAll(closeDb)

describe("newsletter double opt-in", () => {
  const subscribe = (email: string, extra = {}) =>
    publicRequest("/newsletter", {
      method: "POST",
      body: { email, sourcePath: "/insights", ...extra },
    })
  const linkFrom = (text: string, path: string) =>
    text.match(new RegExp(`https?://\\S+${path}\\S*`))![0]

  it("creates a pending row with a hashed token and emails a confirm link", async () => {
    expect((await subscribe("New@Example.com")).status).toBe(201)
    await drain()
    const [row] = await getDb().select().from(newsletterSubscribers)
    expect(row).toMatchObject({ email: "new@example.com", status: "pending" })
    const mail = readOutbox()[0]!
    const confirm = linkFrom(mail.text, "/api/v1/public/newsletter/confirm")
    const token = new URL(confirm).searchParams.get("token")!
    expect(row!.tokenHash).not.toBe(token)
    expect(mail.text).toContain("/newsletter/unsubscribe?token=")
    const url = new URL(confirm)
    const res = await app.request(url.pathname + url.search)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("/newsletter/confirmed")
    const [after] = await getDb().select().from(newsletterSubscribers)
    expect(after).toMatchObject({ status: "confirmed", tokenHash: null })
    // One-time: a second use is invalid.
    expect(
      (await app.request(url.pathname + url.search)).headers.get("location")
    ).toBe("/newsletter/invalid")
  })

  it("answers identically for confirmed, pending and new addresses and never re-mails a confirmed one", async () => {
    await getDb()
      .insert(newsletterSubscribers)
      .values({ email: "done@example.com", status: "confirmed" })
    const a = await subscribe("done@example.com")
    const b = await subscribe("fresh@example.com")
    expect([a.status, await a.json()]).toEqual([b.status, await b.json()])
    await drain()
    expect(readOutbox().map((m) => m.to)).toEqual(["fresh@example.com"])
  })

  it("expires confirm tokens after 7 days", async () => {
    await subscribe("late@example.com")
    await drain()
    const token = new URL(
      linkFrom(readOutbox()[0]!.text, "/api/v1/public/newsletter/confirm")
    ).searchParams.get("token")!
    vi.useFakeTimers({ now: Date.now() + 8 * 86_400_000, toFake: ["Date"] })
    const res = await publicRequest(`/newsletter/confirm?token=${token}`)
    expect(res.headers.get("location")).toBe("/newsletter/invalid")
  })

  it("unsubscribes by POST only, with a forged token answering the same", async () => {
    const [row] = await getDb()
      .insert(newsletterSubscribers)
      .values({ email: "bye@example.com", status: "confirmed" })
      .returning()
    const token = unsubscribeToken(row!.id)
    const forged = await publicRequest("/newsletter/unsubscribe", {
      method: "POST",
      body: { token: `${row!.id}.0000` },
    })
    expect(forged.headers.get("location")).toBe("/newsletter/unsubscribed")
    expect(
      (await getDb().select().from(newsletterSubscribers))[0]!.status
    ).toBe("confirmed")
    await publicRequest("/newsletter/unsubscribe", {
      method: "POST",
      body: { token },
    })
    expect(
      (await getDb().select().from(newsletterSubscribers))[0]!.status
    ).toBe("unsubscribed")
    expect(
      (await publicRequest(`/newsletter/unsubscribe?token=${token}`)).status
    ).toBe(404)
  })

  it("confirms directly when double opt-in is off, and ignores the honeypot silently", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "privacy", value: { newsletterDoubleOptIn: false } })
    await subscribe("direct@example.com")
    expect(
      (await getDb().select().from(newsletterSubscribers))[0]!.status
    ).toBe("confirmed")
    expect((await subscribe("bot@example.com", { website: "x" })).status).toBe(
      201
    )
    expect(await getDb().select().from(newsletterSubscribers)).toHaveLength(1)
  })
})

describe("newsletter admin", () => {
  // [GET /, GET /export.csv, DELETE /:id]
  const MATRIX: Record<RoleName, [number, number, number]> = {
    owner: [200, 200, 200],
    admin: [200, 200, 200],
    marketer: [200, 200, 403],
    editor: [403, 403, 403],
    author: [403, 403, 403],
    intake: [403, 403, 403],
    viewer: [403, 403, 403],
  }
  it.each(ROLE_NAMES)("RBAC for %s", async (role) => {
    const cookie = await cookieFor(role)
    const [row] = await getDb()
      .insert(newsletterSubscribers)
      .values({ email: `${role}-s@example.com`, status: "confirmed" })
      .returning()
    expect([
      (await adminRequest("/newsletter", cookie)).status,
      (await adminRequest("/newsletter/export.csv", cookie)).status,
      (
        await adminRequest(`/newsletter/${row!.id}`, cookie, {
          method: "DELETE",
        })
      ).status,
    ]).toEqual(MATRIX[role])
  })
})

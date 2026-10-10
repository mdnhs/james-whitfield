import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, settings } from "@/server/db/schema"

import { adminRequest, cookieFor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  // The seed may or may not have run; every test starts from a default row.
  await getDb()
    .insert(settings)
    .values({ key: "theme", value: {} })
    .onConflictDoNothing()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)

const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const row = async () =>
  (await getDb().select().from(settings).where(eq(settings.key, "theme")))[0] ??
  null
const doc = async (cookie: string) =>
  (await (await adminRequest("/theme", cookie)).json()) as {
    version: number
    hasDraft: boolean
    value: { site: { brand: string | null } }
    draft: { site: { brand: string | null; tokens: Record<string, string> } }
    issues: unknown[]
  }
const saveDraft = (cookie: string, version: number, draft: unknown) =>
  adminRequest("/theme/draft", cookie, {
    method: "PUT",
    body: { version, draft },
  })
const publish = (cookie: string, version: number) =>
  adminRequest("/theme/publish", cookie, { method: "POST", body: { version } })

// brief §7.2: appearance.* is owner and admin only.
const ALLOWED: RoleName[] = ["owner", "admin"]

describe.each(ROLE_NAMES)("theme RBAC for %s", (role) => {
  it("GET, PUT draft and POST publish", async () => {
    const cookie = await cookieFor(role)
    const allowed = ALLOWED.includes(role)
    const want = allowed ? 200 : 403
    expect((await adminRequest("/theme", cookie)).status).toBe(want)
    // can() runs before the version check, so 0 is fine for the 403s.
    const version = allowed ? (await doc(cookie)).version : 0
    expect((await saveDraft(cookie, version, {})).status).toBe(want)
    expect((await publish(cookie, allowed ? version + 1 : 0)).status).toBe(want)
  })
})

describe("theme API", () => {
  it("saves a draft without touching the published theme or the cache", async () => {
    const cookie = await cookieFor("admin")
    const { version } = await doc(cookie)
    const res = await saveDraft(cookie, version, {
      site: { brand: "#2f5f8a" },
    })
    expect(res.status).toBe(200)
    const saved = await res.json()
    expect(saved.hasDraft).toBe(true)
    expect(saved.draft.site.brand).toMatch(/^oklch\(/)
    expect(saved.value.site.brand).toBeNull()
    expect(expired()).toEqual([])
    expect((await row())!.draft).not.toBeNull()
  })

  it("publishes: copies the draft, clears it, writes a revision, audits, expires the tag", async () => {
    const cookie = await cookieFor("owner")
    const draft = await (
      await saveDraft(cookie, (await doc(cookie)).version, {
        site: { brand: "#2f5f8a" },
      })
    ).json()
    const res = await publish(cookie, draft.version)
    expect(res.status).toBe(200)
    const published = await res.json()
    expect(published.value.site.brand).toBe(draft.draft.site.brand)
    expect(published.hasDraft).toBe(false)
    expect((await row())!.draft).toBeNull()
    expect(expired()).toEqual(["settings:theme"])
    const revisions = await (
      await adminRequest("/theme/revisions", cookie)
    ).json()
    expect(revisions).toHaveLength(1)
    const actions = (await getDb().select().from(auditLogs)).map(
      (a) => a.action
    )
    expect(actions).toContain("appearance.publish")
  })

  it("blocks a failing draft and keeps the published theme", async () => {
    const cookie = await cookieFor("owner")
    const before = await row()
    const saved = await (
      await saveDraft(cookie, (await doc(cookie)).version, {
        site: { tokens: { "text-muted": "#dddddd" } },
      })
    ).json()
    expect(saved.issues.length).toBeGreaterThan(0)
    const res = await publish(cookie, saved.version)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_FAILED")
    expect(body.error.message).toMatch(/Muted text on Cream is \d\.\d{2}:1/)
    expect(body.error.details.issues.length).toBeGreaterThan(0)
    expect((await row())!.value).toEqual(before!.value)
    expect(expired()).toEqual([])
    expect(
      await (await adminRequest("/theme/revisions", cookie)).json()
    ).toHaveLength(0)
  })

  it("409s a stale version", async () => {
    const cookie = await cookieFor("owner")
    const { version } = await doc(cookie)
    expect((await saveDraft(cookie, version, {})).status).toBe(200)
    const stale = await saveDraft(cookie, version, {})
    expect(stale.status).toBe(409)
    expect((await publish(cookie, version)).status).toBe(409)
  })

  it("rejects a hostile colour with a field error", async () => {
    const cookie = await cookieFor("owner")
    const res = await saveDraft(cookie, (await doc(cookie)).version, {
      site: { brand: "#000;}</style><script>alert(1)</script>" },
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.fieldErrors["site.brand"]).toEqual([
      "Use a #rrggbb or oklch(L C H) colour",
    ])
  })

  it("a hand-edited row falls back to the defaults", async () => {
    const cookie = await cookieFor("owner")
    await getDb()
      .update(settings)
      .set({ value: { site: { brand: "url(javascript:1)" } } })
      .where(eq(settings.key, "theme"))
    const current = await doc(cookie)
    expect(current.value.site.brand).toBeNull()
  })

  it("resets the draft to a preset without publishing, and discards", async () => {
    const cookie = await cookieFor("admin")
    const reset = await adminRequest("/theme/reset", cookie, {
      method: "POST",
      body: {
        version: (await doc(cookie)).version,
        preset: "ocean",
        scope: "both",
      },
    })
    expect(reset.status).toBe(200)
    const after = await reset.json()
    expect(after.draft.site).toEqual({
      preset: "ocean",
      brand: null,
      tokens: {},
    })
    expect(after.value.site.preset).toBe("teal-sage")
    const discarded = await adminRequest("/theme/discard", cookie, {
      method: "POST",
      body: { version: after.version },
    })
    expect((await discarded.json()).hasDraft).toBe(false)
  })

  it("restores a revision into the draft", async () => {
    const cookie = await cookieFor("owner")
    const saved = await (
      await saveDraft(cookie, (await doc(cookie)).version, {
        site: { brand: "#6a3f6b" },
      })
    ).json()
    const published = await (await publish(cookie, saved.version)).json()
    const [revision] = await (
      await adminRequest("/theme/revisions", cookie)
    ).json()
    const discardedVersion = (
      await (
        await saveDraft(cookie, published.version, {
          site: { brand: "#2f5f8a" },
        })
      ).json()
    ).version
    const restored = await adminRequest(
      `/theme/revisions/${revision.id}/restore`,
      cookie,
      { method: "POST", body: { version: discardedVersion } }
    )
    expect(restored.status).toBe(200)
    expect((await restored.json()).draft.site.brand).toBe(
      published.value.site.brand
    )
  })

  it("shares the published OG colours with any signed-in user", async () => {
    const res = await adminRequest("/theme/colors", await cookieFor("marketer"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      background: "#030303",
      text: "#faf6f0",
      accent: "#d6e8e4",
    })
  })
})

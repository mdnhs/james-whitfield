import { afterAll, beforeEach, describe, expect, it } from "vitest"

import type { Actor } from "@/server/auth/actor"
import { closeDb, getDb } from "@/server/db/client"
import { eq } from "drizzle-orm"

import { auditLogs, users } from "@/server/db/schema"
import { getDashboard } from "@/server/modules/dashboard/service"
import { weekWindow } from "@/server/modules/dashboard/week"

import {
  adminRequest,
  createUser,
  signIn,
  signInWithTwoFactor,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

const HOUR = 3_600_000
const DAY = 24 * HOUR
const at = (base: Date, ms: number) => new Date(base.getTime() + ms)

async function signedIn(actorId: string, createdAt: Date) {
  await getDb().insert(auditLogs).values({
    actorId,
    action: "auth.sign_in",
    entityType: "user",
    entityId: actorId,
    summary: "Signed in",
    createdAt,
  })
}

async function dashboard(cookie: string) {
  const response = await adminRequest("/dashboard", cookie)
  expect(response.status).toBe(200)
  return response.json()
}

describe("GET /api/v1/admin/dashboard", () => {
  it("counts sign-ins per Irish day, this week against last", async () => {
    const owner = await createUser("owner")
    const cookie = await signInWithTwoFactor("owner@example.com")
    // Drop the sign-in the helper just recorded; only fixtures count.
    await getDb().delete(auditLogs)
    const week = weekWindow(new Date())
    await signedIn(owner.id, at(week.start, 2 * HOUR))
    await signedIn(owner.id, at(week.start, 3 * HOUR))
    await signedIn(owner.id, at(week.previousStart, 2 * HOUR))

    const body = await dashboard(cookie)

    expect(body.signIns).toMatchObject({ current: 2, previous: 1 })
    expect(body.signIns.days).toHaveLength(7)
    expect(body.signIns.days[0]).toEqual({
      key: week.days[0].key,
      label: "Mon",
      current: 2,
      previous: 1,
    })
  })

  it("counts distinct people signing in over 30 days against the 30 before", async () => {
    const owner = await createUser("owner")
    const viewer = await createUser("viewer")
    const cookie = await signInWithTwoFactor("owner@example.com")
    await getDb().delete(auditLogs)
    const now = new Date()
    await signedIn(owner.id, at(now, -1 * DAY))
    await signedIn(owner.id, at(now, -2 * DAY))
    await signedIn(viewer.id, at(now, -3 * DAY))
    await signedIn(viewer.id, at(now, -40 * DAY))

    expect((await dashboard(cookie)).activeUsers).toEqual({
      value: 2,
      previous: 1,
    })
  })

  it("gives a viewer aggregates only (docs/brief.md §7.2)", async () => {
    await createUser("viewer")
    const body = await dashboard(await signIn("viewer@example.com"))
    expect(body.security).toBeNull()
    expect(body.changes).toBeNull()
    expect(body.recentActivity).toBeNull()
    expect(body.nextUp.map((item: { id: string }) => item.id)).toEqual([
      "two-factor",
    ])
    // Two-factor is optional for a viewer, so it is not called required.
    expect(body.nextUp[0].description).not.toMatch(/required/i)
  })

  it("gives an owner security health, changes and recent activity", async () => {
    await createUser("owner")
    await createUser("admin")
    await createUser("viewer")
    const cookie = await signInWithTwoFactor("owner@example.com")

    const body = await dashboard(cookie)

    expect(body.security).toEqual({
      protected: 1,
      requiredMissing: 1,
      optionalMissing: 1,
      total: 3,
    })
    // The owner's sign-in is activity, not a change.
    expect(body.changes).toEqual({ value: 0, previous: 0 })
    expect(body.recentActivity[0]).toMatchObject({
      action: "auth.sign_in",
      actorName: "owner",
    })
    expect(typeof body.recentActivity[0].createdAt).toBe("string")
    expect(body.nextUp).toEqual([
      expect.objectContaining({ id: "two-factor", done: true }),
      expect.objectContaining({ id: "invite", done: true }),
    ])
  })
})

describe("changes this week", () => {
  it("counts content and admin changes, never auth.* rows", async () => {
    const owner = await createUser("owner")
    const cookie = await signInWithTwoFactor("owner@example.com")
    await getDb().delete(auditLogs)
    const week = weekWindow(new Date())
    await signedIn(owner.id, at(week.start, HOUR))
    await getDb()
      .insert(auditLogs)
      .values({
        actorId: owner.id,
        action: "auth.impersonate",
        entityType: "user",
        summary: "Viewed as someone",
        createdAt: at(week.start, HOUR),
      })

    expect((await dashboard(cookie)).changes).toEqual({
      value: 0,
      previous: 0,
    })

    await getDb()
      .insert(auditLogs)
      .values({
        actorId: owner.id,
        action: "user.invite",
        entityType: "user",
        summary: "Invited someone",
        createdAt: at(week.start, HOUR),
      })

    expect((await dashboard(cookie)).changes).toEqual({
      value: 1,
      previous: 0,
    })
  })
})

describe("security health", () => {
  it("counts a user whose ban has expired, not one still banned", async () => {
    await createUser("owner")
    const lapsed = await createUser("editor")
    const banned = await createUser("viewer")
    const forever = await createUser("author")
    const cookie = await signInWithTwoFactor("owner@example.com")
    const hour = (sign: number) => new Date(Date.now() + sign * HOUR)
    await getDb()
      .update(users)
      .set({ banned: true, banExpires: hour(-1) })
      .where(eq(users.id, lapsed.id))
    await getDb()
      .update(users)
      .set({ banned: true, banExpires: hour(1) })
      .where(eq(users.id, banned.id))
    await getDb()
      .update(users)
      .set({ banned: true, banExpires: null })
      .where(eq(users.id, forever.id))

    expect((await dashboard(cookie)).security).toEqual({
      protected: 1,
      requiredMissing: 0,
      optionalMissing: 1,
      total: 2,
    })
  })
})

describe("getDashboard across the October clock change", () => {
  it("buckets sign-ins by the Irish calendar day", async () => {
    const owner = await createUser("owner")
    await getDb().delete(auditLogs)
    // Week of Mon 19 – Sun 25 October 2026; clocks go back 02:00 IST on
    // the Sunday, so the week runs 23:00Z Sunday to 00:00Z Monday.
    await signedIn(owner.id, new Date("2026-10-18T23:30:00Z")) // Mon 00:30 IST
    await signedIn(owner.id, new Date("2026-10-18T22:30:00Z")) // Sun 23:30 IST, last week
    await signedIn(owner.id, new Date("2026-10-25T00:30:00Z")) // Sun 01:30 IST
    await signedIn(owner.id, new Date("2026-10-25T23:30:00Z")) // Sun 23:30 GMT
    await signedIn(owner.id, new Date("2026-10-26T00:00:00Z")) // next Mon 00:00 GMT

    const actor: Actor = {
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      roles: ["owner"],
      twoFactorEnabled: true,
      sessionId: "test",
      impersonatedBy: null,
      ip: null,
      userAgent: null,
    }
    const body = await getDashboard(actor, new Date("2026-10-25T12:00:00Z"))
    const byKey = Object.fromEntries(
      body.signIns.days.map((day) => [day.key, day])
    )

    expect(byKey["2026-10-19"]).toMatchObject({ current: 1, previous: 0 })
    expect(byKey["2026-10-25"]).toMatchObject({ current: 2, previous: 1 })
    expect(body.signIns).toMatchObject({ current: 3, previous: 1 })
  })
})

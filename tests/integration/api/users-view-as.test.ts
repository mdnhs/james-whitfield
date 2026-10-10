import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, sessions, users } from "@/server/db/schema"

import { adminRequest, cookieFor, createUser, ORIGIN } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

// Applies Set-Cookie values to a Cookie header the way a browser does:
// a later value for a name replaces the earlier one; an empty value deletes.
function apply(cookie: string, setCookies: string[]) {
  const jar = new Map(
    cookie
      .split("; ")
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf("=")
        return [p.slice(0, i), p.slice(i + 1)] as const
      })
  )
  for (const header of setCookies) {
    const pair = header.split(";")[0]!
    const i = pair.indexOf("=")
    const [name, value] = [pair.slice(0, i), pair.slice(i + 1)]
    if (value) jar.set(name, value)
    else jar.delete(name)
  }
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ")
}

const start = (cookie: string, id: string) =>
  adminRequest(`/users/${id}/impersonate`, cookie, { method: "POST" })

const me = async (cookie: string) => (await adminRequest("/me", cookie)).json()

describe("POST /users/:id/impersonate", () => {
  it("lets an owner view as an editor, for at most an hour, audited", async () => {
    const owner = await cookieFor("owner")
    const editor = await createUser("editor", "ed@example.com")

    const response = await start(owner, editor.id)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })
    const viewing = apply(owner, response.headers.getSetCookie())
    const who = await me(viewing)
    expect(who.user.email).toBe("ed@example.com")
    expect(who.impersonatedBy).toBeTruthy()
    expect((await adminRequest("/users", viewing)).status).toBe(403)
    const [row] = await getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.userId, editor.id))
    expect(row!.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(3600_000)
    const audits = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "auth.impersonate"))
    expect(audits).toHaveLength(1)
    expect(audits[0]!.entityId).toBe(editor.id)
  })

  it("an admin cannot view as an owner or another admin", async () => {
    const admin = await cookieFor("admin")
    const owner = await createUser("owner", "o@example.com")
    const other = await createUser("admin", "a2@example.com")
    await getDb()
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, other.id))
    expect((await start(admin, owner.id)).status).toBe(403)
    expect((await start(admin, other.id)).status).toBe(403)
    expect(
      await getDb()
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "auth.impersonate"))
    ).toHaveLength(0)
  })

  it("lets an owner view as an admin", async () => {
    const owner = await cookieFor("owner")
    const admin = await createUser("admin", "ad@example.com")
    await getDb()
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, admin.id))
    expect((await start(owner, admin.id)).status).toBe(200)
  })

  it("refuses yourself, a banned person and a target who must still set up two-factor", async () => {
    const owner = await cookieFor("owner")
    const self = (await getDb().query.users.findFirst({
      where: eq(users.email, "owner@example.com"),
    }))!
    const banned = await createUser("editor", "b@example.com")
    await getDb()
      .update(users)
      .set({ banned: true })
      .where(eq(users.id, banned.id))
    const noTwoFactor = await createUser("admin", "n@example.com")
    expect((await start(owner, self.id)).status).toBe(403)
    expect((await start(owner, banned.id)).status).toBe(409)
    expect((await start(owner, noTwoFactor.id)).status).toBe(409)
  })

  it("refuses while already viewing as someone", async () => {
    const owner = await cookieFor("owner")
    const a = await createUser("admin", "a@example.com")
    await getDb()
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, a.id))
    const b = await createUser("editor", "b@example.com")
    const viewing = apply(
      owner,
      (await start(owner, a.id)).headers.getSetCookie()
    )
    const again = await start(viewing, b.id)
    expect(again.status).toBe(403)
    expect((await again.json()).error.code).toBe("IMPERSONATION_READ_ONLY")
  })

  it("View-as survives a session refresh on the same response", async () => {
    const owner = await cookieFor("owner")
    const editor = await createUser("editor", "ed@example.com")
    // Due for Better Auth's daily refresh (expiresIn 7d, updateAge 1d).
    await getDb()
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() + 5 * 86_400_000) })
    const response = await start(owner, editor.id)
    const viewing = apply(owner, response.headers.getSetCookie())
    expect((await me(viewing)).user.email).toBe("ed@example.com")
  })

  it("stopping restores the actor and audits it", async () => {
    const owner = await cookieFor("owner")
    const editor = await createUser("editor", "ed@example.com")
    const viewing = apply(
      owner,
      (await start(owner, editor.id)).headers.getSetCookie()
    )

    const stop = await app.request("/api/auth/admin/stop-impersonating", {
      method: "POST",
      headers: {
        cookie: viewing,
        origin: ORIGIN,
        "content-type": "application/json",
      },
      body: "{}",
    })

    expect(stop.status).toBe(200)
    expect(JSON.stringify(await stop.json())).not.toMatch(/"token"/)
    const back = apply(viewing, stop.headers.getSetCookie())
    expect((await me(back)).user.email).toBe("owner@example.com")
    const [row] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "auth.stop_impersonate"))
    expect(row).toMatchObject({
      entityId: editor.id,
      summary: "Stopped viewing as editor",
    })
    expect(row!.actorId).toBe(
      (await getDb().query.users.findFirst({
        where: eq(users.email, "owner@example.com"),
      }))!.id
    )
  })

  it("a banned person's View-as session ends with the ban", async () => {
    const owner = await cookieFor("owner")
    const admin = await cookieFor("admin")
    const editor = await createUser("editor", "ed@example.com")
    const viewing = apply(
      admin,
      (await start(admin, editor.id)).headers.getSetCookie()
    )
    const adminId = (await getDb().query.users.findFirst({
      where: eq(users.email, "admin@example.com"),
    }))!.id
    await adminRequest(`/users/${adminId}/ban`, owner, {
      method: "POST",
      body: {},
    })
    expect((await adminRequest("/me", viewing)).status).toBe(401)
  })
})

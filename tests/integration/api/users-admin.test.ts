import { eq } from "drizzle-orm"
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import type { RoleName } from "@/lib/auth/permissions"
import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, authors, sessions, users } from "@/server/db/schema"
import { clearOutbox, readOutbox } from "@/server/lib/email"

import {
  adminRequest,
  cookieFor,
  createUser,
  signIn,
  signInWithTwoFactor,
  viewAs,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterEach(clearOutbox)
afterAll(closeDb)

const ROLES: RoleName[] = [
  "owner",
  "admin",
  "editor",
  "author",
  "marketer",
  "intake",
  "viewer",
]
type Item = { email: string; lastActiveAt: string } & Record<string, unknown>
type Body = {
  items: Item[]
  total: number
  id: string
  roles: string[]
  author: unknown
  error: { code: string }
} & Record<string, unknown>
const json = async (r: Response) => (await r.json()) as Body
const roleOf = async (id: string) =>
  (await getDb().query.users.findFirst({ where: eq(users.id, id) }))?.role
const actions = async (action: string) =>
  getDb().select().from(auditLogs).where(eq(auditLogs.action, action))

describe("GET /users (user.list)", () => {
  it.each(ROLES)("as %s", async (role) => {
    const cookie = await cookieFor(role)
    const response = await adminRequest("/users", cookie)
    expect(response.status).toBe(
      role === "owner" || role === "admin" ? 200 : 403
    )
  })

  it("lists roles, 2FA, invite state and last activity, and nothing secret", async () => {
    const cookie = await cookieFor("owner")
    await createUser("editor", "ed@example.com")
    await signIn("ed@example.com")
    await adminRequest("/users/invite", cookie, {
      method: "POST",
      body: { email: "new@example.com", name: "New", role: "viewer" },
    })

    const body = await json(await adminRequest("/users?pageSize=10", cookie))

    expect(body.total).toBe(3)
    const ed = body.items.find((u: Item) => u.email === "ed@example.com")!
    expect(ed).toMatchObject({
      roles: ["editor"],
      twoFactorEnabled: false,
      banned: false,
      invitePending: false,
      author: null,
    })
    expect(Date.parse(ed.lastActiveAt)).toBeGreaterThan(Date.now() - 60_000)
    const invited = body.items.find((u: Item) => u.email === "new@example.com")
    expect(invited).toMatchObject({ invitePending: true, lastActiveAt: null })
    expect(Object.keys(ed).sort()).toEqual(
      [
        "author",
        "banExpires",
        "banReason",
        "banned",
        "createdAt",
        "email",
        "id",
        "invitePending",
        "lastActiveAt",
        "name",
        "roles",
        "twoFactorEnabled",
      ].sort()
    )
  })

  it("filters by search, role and status", async () => {
    const cookie = await cookieFor("owner")
    await createUser("editor", "zed@example.com")
    const v = await createUser("viewer", "vee@example.com")
    await getDb().update(users).set({ banned: true }).where(eq(users.id, v.id))

    const q = await json(await adminRequest("/users?q=ZED", cookie))
    expect(q.items.map((u: Item) => u.email)).toEqual(["zed@example.com"])
    const role = await json(await adminRequest("/users?role=viewer", cookie))
    expect(role.items.map((u: Item) => u.email)).toEqual(["vee@example.com"])
    const banned = await json(
      await adminRequest("/users?status=banned", cookie)
    )
    expect(banned.items.map((u: Item) => u.email)).toEqual(["vee@example.com"])
    // A literal % is a search for "%", not a wildcard.
    expect((await json(await adminRequest("/users?q=%25", cookie))).total).toBe(
      0
    )
  })
})

describe("PATCH /users/:id/role", () => {
  const setRoles = (cookie: string, id: string, roles: unknown) =>
    adminRequest(`/users/${id}/role`, cookie, {
      method: "PATCH",
      body: { roles },
    })

  it.each(ROLES)("needs user.set-role (as %s)", async (role) => {
    const cookie = await cookieFor(role)
    const target = await createUser("viewer", "t@example.com")
    const response = await setRoles(cookie, target.id, ["editor"])
    expect(response.status).toBe(
      role === "owner" || role === "admin" ? 200 : 403
    )
  })

  it("stores several roles in a fixed order and audits the change", async () => {
    const cookie = await cookieFor("admin")
    const target = await createUser("viewer", "t@example.com")
    const response = await setRoles(cookie, target.id, ["marketer", "editor"])
    expect(response.status).toBe(200)
    expect((await json(response)).roles).toEqual(["editor", "marketer"])
    expect(await roleOf(target.id)).toBe("editor,marketer")
    const [row] = await actions("user.role")
    expect(row).toMatchObject({
      entityId: target.id,
      diff: { role: { from: "viewer", to: "editor,marketer" } },
    })
  })

  it("never lets an admin change an owner or grant owner", async () => {
    const cookie = await cookieFor("admin")
    const owner = await createUser("owner", "o@example.com")
    const editor = await createUser("editor", "e@example.com")
    expect((await setRoles(cookie, owner.id, ["viewer"])).status).toBe(403)
    expect((await setRoles(cookie, editor.id, ["owner"])).status).toBe(403)
    expect(await roleOf(owner.id)).toBe("owner")
    expect(await roleOf(editor.id)).toBe("editor")
  })

  it("lets an owner promote and demote another owner", async () => {
    const cookie = await cookieFor("owner")
    const other = await createUser("editor", "o2@example.com")
    expect((await setRoles(cookie, other.id, ["owner"])).status).toBe(200)
    expect((await setRoles(cookie, other.id, ["admin"])).status).toBe(200)
    expect(await roleOf(other.id)).toBe("admin")
  })

  it("refuses your own role, unknown roles and duplicates", async () => {
    const cookie = await cookieFor("owner")
    const me = await getDb().query.users.findFirst({
      where: eq(users.email, "owner@example.com"),
    })
    const target = await createUser("viewer", "t@example.com")
    expect((await setRoles(cookie, me!.id, ["admin"])).status).toBe(403)
    expect((await setRoles(cookie, target.id, ["root"])).status).toBe(400)
    expect(
      (await setRoles(cookie, target.id, ["editor", "editor"])).status
    ).toBe(400)
    expect((await setRoles(cookie, target.id, [])).status).toBe(400)
  })

  it("404s an unknown person and refuses a cross-origin call", async () => {
    const cookie = await cookieFor("owner")
    const target = await createUser("viewer", "t@example.com")
    expect(
      (
        await setRoles(cookie, "00000000-0000-4000-8000-000000000000", [
          "editor",
        ])
      ).status
    ).toBe(404)
    const cross = await adminRequest(`/users/${target.id}/role`, cookie, {
      method: "PATCH",
      body: { roles: ["editor"] },
      origin: "https://evil.example",
    })
    expect(cross.status).toBe(403)
  })

  it("two owners demoting each other at once leave one owner", async () => {
    await createUser("owner", "a@example.com")
    await createUser("owner", "b@example.com")
    const a = await signInWithTwoFactor("a@example.com")
    const b = await signInWithTwoFactor("b@example.com")
    const idOf = async (email: string) =>
      (await getDb().query.users.findFirst({ where: eq(users.email, email) }))!
        .id
    const [ra, rb] = await Promise.all([
      setRoles(a, await idOf("b@example.com"), ["admin"]),
      setRoles(b, await idOf("a@example.com"), ["admin"]),
    ])
    expect([ra.status, rb.status].sort()).toEqual([200, 403])
    const owners = (await getDb().select().from(users)).filter((u) =>
      (u.role ?? "").split(",").includes("owner")
    )
    expect(owners).toHaveLength(1)
  })
})

describe("ban and unban", () => {
  it("a ban signs the person out everywhere, View-as sessions included", async () => {
    const cookie = await cookieFor("owner")
    const target = await createUser("admin", "ad@example.com")
    const one = await signInWithTwoFactor("ad@example.com")
    const two = await signIn("ad@example.com")
    const editor = await createUser("editor", "ed@example.com")
    const viewing = await viewAs(one, editor.id)

    const response = await adminRequest(`/users/${target.id}/ban`, cookie, {
      method: "POST",
      body: { reason: "Left the practice", days: 30 },
    })

    expect(response.status).toBe(200)
    expect(await json(response)).toMatchObject({
      banned: true,
      banReason: "Left the practice",
    })
    for (const c of [one, two, viewing])
      expect((await adminRequest("/me", c)).status).toBe(401)
    expect(
      await getDb()
        .select()
        .from(sessions)
        .where(eq(sessions.userId, target.id))
    ).toHaveLength(0)
    await expect(
      getAuth().api.signInEmail({
        body: {
          email: "ad@example.com",
          password: "correct horse battery staple",
        },
      })
    ).rejects.toThrow()
    expect(await actions("user.ban")).toHaveLength(1)
  })

  it("a banned person's surviving session is refused on the next request", async () => {
    const target = await createUser("editor", "ed@example.com")
    const cookie = await signIn("ed@example.com")
    expect((await adminRequest("/me", cookie)).status).toBe(200)
    // The session row survives (e.g. a ban written elsewhere): getFreshSession
    // must still treat the person as signed out.
    await getDb()
      .update(users)
      .set({ banned: true })
      .where(eq(users.id, target.id))
    expect(
      await getDb()
        .select()
        .from(sessions)
        .where(eq(sessions.userId, target.id))
    ).toHaveLength(1)
    expect((await adminRequest("/me", cookie)).status).toBe(401)
  })

  it("an expired ban no longer blocks", async () => {
    const cookie = await cookieFor("owner")
    const target = await createUser("editor", "ed@example.com")
    await adminRequest(`/users/${target.id}/ban`, cookie, {
      method: "POST",
      body: { days: 1 },
    })
    await getDb()
      .update(users)
      .set({ banExpires: new Date(Date.now() - 1000) })
      .where(eq(users.id, target.id))
    const fresh = await signIn("ed@example.com")
    expect((await adminRequest("/me", fresh)).status).toBe(200)
  })

  it("unban clears the ban and is audited", async () => {
    const cookie = await cookieFor("admin")
    const target = await createUser("editor", "ed@example.com")
    await adminRequest(`/users/${target.id}/ban`, cookie, {
      method: "POST",
      body: {},
    })
    const response = await adminRequest(`/users/${target.id}/unban`, cookie, {
      method: "POST",
    })
    expect(await json(response)).toMatchObject({
      banned: false,
      banReason: null,
      banExpires: null,
    })
    expect(await actions("user.unban")).toHaveLength(1)
  })

  it("an admin cannot ban an owner; nobody bans themselves", async () => {
    const admin = await cookieFor("admin")
    const owner = await createUser("owner", "o@example.com")
    expect(
      (
        await adminRequest(`/users/${owner.id}/ban`, admin, {
          method: "POST",
          body: {},
        })
      ).status
    ).toBe(403)
    const me = await getDb().query.users.findFirst({
      where: eq(users.email, "admin@example.com"),
    })
    expect(
      (
        await adminRequest(`/users/${me!.id}/ban`, admin, {
          method: "POST",
          body: {},
        })
      ).status
    ).toBe(403)
  })

  it("two owners banning each other at once leave one owner", async () => {
    await createUser("owner", "a@example.com")
    await createUser("owner", "b@example.com")
    const a = await signInWithTwoFactor("a@example.com")
    const b = await signInWithTwoFactor("b@example.com")
    const id = async (email: string) =>
      (await getDb().query.users.findFirst({ where: eq(users.email, email) }))!
        .id
    const [ra, rb] = await Promise.all([
      adminRequest(`/users/${await id("b@example.com")}/ban`, a, {
        method: "POST",
        body: {},
      }),
      adminRequest(`/users/${await id("a@example.com")}/ban`, b, {
        method: "POST",
        body: {},
      }),
    ])
    // The loser's own session was deleted by the winner's ban: 401, or 403/409
    // when it got past the session check before the ban committed.
    expect([ra.status, rb.status].filter((s) => s === 200)).toHaveLength(1)
    const active = (await getDb().select().from(users)).filter((u) => !u.banned)
    expect(active).toHaveLength(1)
  })
})

describe("DELETE /users/:id/sessions (session.revoke)", () => {
  it("signs every device out and reports the count", async () => {
    const cookie = await cookieFor("admin")
    const target = await createUser("editor", "ed@example.com")
    const one = await signIn("ed@example.com")
    const two = await signIn("ed@example.com")
    const response = await adminRequest(
      `/users/${target.id}/sessions`,
      cookie,
      { method: "DELETE" }
    )
    expect(await json(response)).toEqual({ revoked: 2 })
    for (const c of [one, two])
      expect((await adminRequest("/me", c)).status).toBe(401)
    expect(await actions("user.sessions_revoke")).toHaveLength(1)
  })

  it.each(ROLES.filter((r) => r !== "owner" && r !== "admin"))(
    "is refused for %s",
    async (role) => {
      const cookie = await cookieFor(role)
      const target = await createUser("viewer", "t@example.com")
      const r = await adminRequest(`/users/${target.id}/sessions`, cookie, {
        method: "DELETE",
      })
      expect(r.status).toBe(403)
    }
  )
})

describe("DELETE /users/:id (user.delete)", () => {
  it("deletes a person; their audit rows keep the email", async () => {
    const cookie = await cookieFor("owner")
    const target = await createUser("editor", "ed@example.com")
    const edCookie = await signIn("ed@example.com")
    const response = await adminRequest(`/users/${target.id}`, cookie, {
      method: "DELETE",
    })
    expect(response.status).toBe(200)
    expect((await adminRequest("/me", edCookie)).status).toBe(401)
    expect(
      await getDb().query.users.findFirst({ where: eq(users.id, target.id) })
    ).toBeUndefined()
    const [del] = await actions("user.delete")
    expect(del).toMatchObject({
      entityId: target.id,
      summary: "Deleted ed@example.com",
    })
  })

  it("an admin cannot delete an owner; nobody deletes themselves", async () => {
    const admin = await cookieFor("admin")
    const owner = await createUser("owner", "o@example.com")
    expect(
      (await adminRequest(`/users/${owner.id}`, admin, { method: "DELETE" }))
        .status
    ).toBe(403)
    const me = await getDb().query.users.findFirst({
      where: eq(users.email, "admin@example.com"),
    })
    expect(
      (await adminRequest(`/users/${me!.id}`, admin, { method: "DELETE" }))
        .status
    ).toBe(403)
  })
})

describe("POST /users/:id/resend-invite", () => {
  it("re-sends a pending invite and refuses once a password is set", async () => {
    const cookie = await cookieFor("owner")
    const invited = await json(
      await adminRequest("/users/invite", cookie, {
        method: "POST",
        body: { email: "new@example.com", name: "New", role: "viewer" },
      })
    )
    clearOutbox()
    const again = await adminRequest(
      `/users/${invited.id}/resend-invite`,
      cookie,
      { method: "POST" }
    )
    expect(again.status).toBe(200)
    expect(readOutbox()[0]!.subject).toBe(
      "You're invited to the Magda Kennedy admin"
    )
    const active = await createUser("editor", "ed@example.com")
    const done = await adminRequest(
      `/users/${active.id}/resend-invite`,
      cookie,
      { method: "POST" }
    )
    expect(done.status).toBe(409)
  })
})

describe("PUT /users/:id/author", () => {
  const author = async (slug: string) =>
    (await getDb().insert(authors).values({ slug, name: slug }).returning())[0]!

  it("links one author, moves the link, refuses someone else's, unlinks", async () => {
    const cookie = await cookieFor("admin")
    const writer = await createUser("author", "w@example.com")
    const other = await createUser("author", "x@example.com")
    const a1 = await author("anna")
    const a2 = await author("ben")
    const put = (id: string, authorId: string | null) =>
      adminRequest(`/users/${id}/author`, cookie, {
        method: "PUT",
        body: { authorId },
      })

    expect((await json(await put(writer.id, a1.id))).author).toEqual({
      id: a1.id,
      name: "anna",
    })
    await put(writer.id, a2.id)
    const linked = await getDb()
      .select()
      .from(authors)
      .where(eq(authors.userId, writer.id))
    expect(linked.map((a) => a.id)).toEqual([a2.id])
    expect((await put(other.id, a2.id)).status).toBe(409)
    expect((await json(await put(writer.id, null))).author).toBeNull()
    expect(await actions("user.author_link")).toHaveLength(3)
  })
})

describe("View-as sessions", () => {
  it("user management refuses a View-as session", async () => {
    const owner = await cookieFor("owner")
    const admin = await createUser("admin", "ad@example.com")
    await getDb()
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, admin.id))
    const target = await createUser("viewer", "t@example.com")
    const viewing = await viewAs(owner, admin.id)
    const r = await adminRequest(`/users/${target.id}/role`, viewing, {
      method: "PATCH",
      body: { roles: ["editor"] },
    })
    expect(r.status).toBe(403)
    expect((await json(r)).error.code).toBe("IMPERSONATION_READ_ONLY")
  })
})

import { eq } from "drizzle-orm"
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, sessions, users } from "@/server/db/schema"
import { clearOutbox, readOutbox } from "@/server/lib/email"

import {
  adminRequest,
  createUser,
  ORIGIN,
  PASSWORD,
  signIn,
  signInWithTwoFactor,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterEach(clearOutbox)
afterAll(closeDb)

const authPost = (path: string, cookie: string, body: unknown) =>
  app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
    body: JSON.stringify(body),
  })

const authGet = (path: string, cookie: string) =>
  app.request(`/api/auth${path}`, { headers: { cookie, origin: ORIGIN } })

const expectDisabled = async (response: Response, label: string) => {
  expect(response.status, label).toBe(403)
  expect((await response.json()).code, label).toBe("ADMIN_ENDPOINT_DISABLED")
}

const roleOf = async (id: string) =>
  (
    await getDb()
      .select({ role: users.role, banned: users.banned })
      .from(users)
      .where(eq(users.id, id))
  )[0]

// Better Auth's admin endpoints check the caller's role, never the target, so
// over HTTP they would let an admin escalate to owner or take over an owner
// (docs/brief.md §7.2). They are refused; our services call them server-side.
describe("Better Auth /admin/* over HTTP", () => {
  it("refuses an admin making themselves owner", async () => {
    const admin = await createUser("admin")
    const cookie = await signInWithTwoFactor("admin@example.com")

    await expectDisabled(
      await authPost("/admin/set-role", cookie, {
        userId: admin.id,
        role: "owner",
      }),
      "set-role"
    )
    expect((await roleOf(admin.id)).role).toBe("admin")
  })

  it("refuses an admin creating an owner", async () => {
    await createUser("admin")
    const cookie = await signInWithTwoFactor("admin@example.com")

    await expectDisabled(
      await authPost("/admin/create-user", cookie, {
        email: "mint@example.com",
        password: PASSWORD,
        name: "Mint",
        role: "owner",
      }),
      "create-user"
    )
    const minted = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, "mint@example.com"))
    expect(minted).toHaveLength(0)
  })

  it("refuses an admin setting an owner's password", async () => {
    const owner = await createUser("owner")
    await createUser("admin")
    const cookie = await signInWithTwoFactor("admin@example.com")

    await expectDisabled(
      await authPost("/admin/set-user-password", cookie, {
        userId: owner.id,
        newPassword: "attacker chosen password",
      }),
      "set-user-password"
    )
    // The owner's own password still works.
    expect(await signIn("owner@example.com")).toContain("mk.session_token=")
  })

  it("refuses banning, removing or impersonating an owner", async () => {
    const owner = await createUser("owner")
    await createUser("admin")
    const cookie = await signInWithTwoFactor("admin@example.com")

    for (const path of [
      "/admin/ban-user",
      "/admin/remove-user",
      "/admin/impersonate-user",
    ]) {
      await expectDisabled(
        await authPost(path, cookie, { userId: owner.id }),
        path
      )
    }
    expect(await roleOf(owner.id)).toEqual({ role: "owner", banned: false })
    const viewAs = await getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.userId, owner.id))
    expect(viewAs).toHaveLength(0)
  })

  it("refuses every other admin endpoint, even for an owner", async () => {
    await createUser("owner")
    const target = await createUser("viewer")
    const cookie = await signInWithTwoFactor("owner@example.com")

    for (const [path, body] of [
      ["/admin/update-user", { userId: target.id, data: { name: "X" } }],
      ["/admin/unban-user", { userId: target.id }],
      ["/admin/revoke-user-session", { sessionToken: "x" }],
      ["/admin/revoke-user-sessions", { userId: target.id }],
      ["/admin/list-user-sessions", { userId: target.id }],
      ["/admin/has-permission", { permissions: { user: ["create"] } }],
    ] as const) {
      await expectDisabled(await authPost(path, cookie, body), path)
    }
    for (const path of [
      "/admin/list-users",
      `/admin/get-user?id=${target.id}`,
    ]) {
      await expectDisabled(await authGet(path, cookie), path)
    }
  })

  it("still lets anyone end a View-as session", async () => {
    await createUser("owner")
    const cookie = await signInWithTwoFactor("owner@example.com")

    const response = await authPost("/admin/stop-impersonating", cookie, {})

    // Not impersonating, so Better Auth itself refuses, not our guard.
    const body = await response.json().catch(() => ({}))
    expect(body.code).not.toBe("ADMIN_ENDPOINT_DISABLED")
  })

  it("leaves the invite flow (server-side createUser) working", async () => {
    await createUser("owner")
    const cookie = await signInWithTwoFactor("owner@example.com")

    const response = await adminRequest("/users/invite", cookie, {
      method: "POST",
      body: { email: "new@example.com", name: "New", role: "editor" },
    })

    expect(response.status).toBe(201)
    expect(readOutbox().map((message) => message.to)).toEqual([
      "new@example.com",
    ])
  })
})

describe("auditing during View-as", () => {
  it("records the real user behind an impersonated mutation", async () => {
    const owner = await createUser("owner")
    const admin = await createUser("admin")
    const ownerCookie = await signInWithTwoFactor("owner@example.com")
    await signInWithTwoFactor("admin@example.com")

    // Started server-side, as a Phase 10 View-as route will.
    const started = await getAuth().api.impersonateUser({
      body: { userId: admin.id },
      headers: new Headers({ cookie: ownerCookie }),
      asResponse: true,
    })
    expect(started.status).toBe(200)
    const viewAsCookie = started.headers
      .getSetCookie()
      .map((cookie) => cookie.split(";")[0])
      .filter((pair) => !pair.endsWith("="))
      .join("; ")

    const response = await adminRequest("/users/invite", viewAsCookie, {
      method: "POST",
      body: { email: "new@example.com", name: "New", role: "editor" },
    })
    expect(response.status).toBe(201)

    const [row] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "user.invite"))
    expect(row.actorId).toBe(admin.id)
    expect(row.impersonatedBy).toBe(owner.id)

    const [start] = await getDb()
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "auth.impersonate"))
    expect(start).toMatchObject({ actorId: owner.id, entityId: admin.id })
  })
})

// The reset email carries its token to the callback URL, so an off-origin
// redirectTo would hand live reset and invite tokens to another site.
describe("request-password-reset", () => {
  it("refuses an off-origin redirectTo and sends nothing", async () => {
    await createUser("editor")

    const response = await authPost("/request-password-reset", "", {
      email: "editor@example.com",
      redirectTo: "https://evil.example/steal",
    })

    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe("INVALID_REDIRECT_URL")
    expect(readOutbox()).toHaveLength(0)
  })

  it("accepts our own reset page", async () => {
    await createUser("editor")

    const response = await authPost("/request-password-reset", "", {
      email: "editor@example.com",
      redirectTo: `${ORIGIN}/admin/reset-password`,
    })

    expect(response.status).toBe(200)
    expect(readOutbox()).toHaveLength(1)
  })
})

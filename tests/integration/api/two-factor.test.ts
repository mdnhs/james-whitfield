import { eq } from "drizzle-orm"
import { TOTP } from "otpauth"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"

import {
  adminRequest,
  createUser,
  markTwoFactorEnabled,
  ORIGIN,
  PASSWORD,
  signIn,
  signInWithTwoFactor,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

// docs/brief.md §7.4: owners and admins must use two-factor. The panel
// redirects them to setup; the API itself refuses them too.
describe("two-factor enforcement on the admin API", () => {
  it.each(["owner", "admin"] as const)(
    "refuses an %s without two-factor beyond /me",
    async (role) => {
      await createUser(role)
      const cookie = await signIn(`${role}@example.com`)

      const response = await adminRequest("/audit", cookie)

      expect(response.status).toBe(403)
      expect((await response.json()).error.code).toBe("TWO_FACTOR_REQUIRED")
    }
  )

  it("refuses mutations too", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")

    const response = await adminRequest("/users/invite", cookie, {
      method: "POST",
      body: { email: "new@example.com", name: "New", role: "editor" },
    })

    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe("TWO_FACTOR_REQUIRED")
  })

  it("still answers /me, so the client can send them to setup", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")

    const response = await adminRequest("/me", cookie)

    expect(response.status).toBe(200)
    expect((await response.json()).twoFactorEnabled).toBe(false)
  })

  it("lets an owner through once two-factor is on", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")
    await markTwoFactorEnabled("owner@example.com")

    expect((await adminRequest("/audit", cookie)).status).toBe(200)
  })

  it("does not require two-factor for other roles", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")

    // Past the 2FA check: the role check is what refuses a viewer here.
    const response = await adminRequest("/audit", cookie)
    expect((await response.json()).error.code).toBe("FORBIDDEN")
  })
})

// Better Auth's admin-plugin endpoints are served by Better Auth itself, not
// the Hono admin routes, so they need the same rule.
describe("two-factor enforcement on /api/auth/admin/*", () => {
  const authPost = (path: string, cookie: string, body: unknown) =>
    app.request(`/api/auth${path}`, {
      method: "POST",
      headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(body),
    })

  it("refuses impersonate-user and set-role for an owner without two-factor", async () => {
    await createUser("owner")
    const target = await createUser("owner", "other-owner@example.com")
    const cookie = await signIn("owner@example.com")

    for (const [path, body] of [
      ["/admin/impersonate-user", { userId: target.id }],
      ["/admin/set-role", { userId: target.id, role: "viewer" }],
    ] as const) {
      const response = await authPost(path, cookie, body)
      expect(response.status, path).toBe(403)
      expect((await response.json()).code, path).toBe("TWO_FACTOR_REQUIRED")
    }
  })

  it("cannot be dodged with path variants", async () => {
    await createUser("owner")
    const target = await createUser("viewer")
    const cookie = await signIn("owner@example.com")

    for (const path of [
      "/admin/set-role/",
      "/ADMIN/set-role",
      "/admin/%73et-role",
      "/admin//set-role",
    ]) {
      const response = await authPost(path, cookie, {
        userId: target.id,
        role: "owner",
      })
      expect(response.status, path).not.toBe(200)
    }
    const [{ role }] = await getDb()
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, target.id))
    expect(role).toBe("viewer")
  })

  it("allows them once two-factor is on", async () => {
    await createUser("owner")
    const target = await createUser("viewer")
    const cookie = await signInWithTwoFactor("owner@example.com")

    const setRole = await authPost("/admin/set-role", cookie, {
      userId: target.id,
      role: "editor",
    })
    expect(setRole.status).toBe(200)
    const impersonate = await authPost("/admin/impersonate-user", cookie, {
      userId: target.id,
    })
    expect(impersonate.status).toBe(200)
  })
})

const cookieHeader = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => !pair.endsWith("="))
    .join("; ")

// Real enrolment through Better Auth: enable, then verify a TOTP code.
async function enrol(cookie: string) {
  const auth = getAuth()
  const enabled = await auth.api.enableTwoFactor({
    body: { password: PASSWORD },
    headers: new Headers({ cookie }),
  })
  if (enabled.method !== "totp") throw new Error("expected TOTP setup")
  const totp = new TOTP({
    secret: new URL(enabled.totpURI).searchParams.get("secret")!,
  })
  const verified = await auth.api.verifyTOTP({
    body: { code: totp.generate() },
    headers: new Headers({ cookie }),
    asResponse: true,
  })
  expect(verified.status).toBe(200)
  return { cookie: cookieHeader(verified), totp }
}

describe("enrolling in two-factor", () => {
  it("revokes the user's other (password-only) sessions", async () => {
    await createUser("owner")
    const sessionA = await signIn("owner@example.com")
    const sessionB = await signIn("owner@example.com")

    const enrolled = await enrol(sessionB)

    // A was signed in with a password only: it must not inherit the flag.
    expect((await adminRequest("/me", sessionA)).status).toBe(401)
    // The session that enrolled carries on, now with full access.
    expect((await adminRequest("/audit", enrolled.cookie)).status).toBe(200)
  })

  it("leaves other sessions alone on a later two-factor sign-in", async () => {
    await createUser("owner")
    const enrolled = await enrol(await signIn("owner@example.com"))

    // Password step: no session yet, only the two-factor challenge cookie.
    const challenge = await getAuth().api.signInEmail({
      body: { email: "owner@example.com", password: PASSWORD },
      asResponse: true,
    })
    const verified = await getAuth().api.verifyTOTP({
      body: { code: enrolled.totp.generate() },
      headers: new Headers({ cookie: cookieHeader(challenge) }),
      asResponse: true,
    })
    expect(verified.status).toBe(200)

    expect((await adminRequest("/audit", cookieHeader(verified))).status).toBe(
      200
    )
    expect((await adminRequest("/audit", enrolled.cookie)).status).toBe(200)
  })
})

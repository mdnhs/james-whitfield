import { eq } from "drizzle-orm"
import { TOTP } from "otpauth"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, users } from "@/server/db/schema"

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
afterAll(closeDb)

// Change 2026-10-11 (product owner): two-factor is optional for every role.
// No admin API route refuses a signed-in user for not having it.
describe("no two-factor gate on the admin API", () => {
  it.each(["owner", "admin"] as const)(
    "lets an %s without two-factor read past /me",
    async (role) => {
      await createUser(role)
      const cookie = await signIn(`${role}@example.com`)

      const response = await adminRequest("/audit", cookie)

      expect(response.status).toBe(200)
    }
  )

  it("lets an owner without two-factor make changes", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")

    const response = await adminRequest("/users/invite", cookie, {
      method: "POST",
      body: { email: "new@example.com", name: "New", role: "editor" },
    })

    expect(response.status).toBeLessThan(300)
  })

  it("reports the flag on /me", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")

    const response = await adminRequest("/me", cookie)

    expect(response.status).toBe(200)
    expect((await response.json()).twoFactorEnabled).toBe(false)
  })

  it("still checks the role", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")

    const response = await adminRequest("/audit", cookie)
    expect((await response.json()).error.code).toBe("FORBIDDEN")
  })
})

// Better Auth's admin-plugin endpoints are not served over HTTP at all
// (tests/integration/api/admin-endpoints.test.ts). A server-side call made
// with an owner's headers works with or without two-factor.
describe("Better Auth admin endpoints", () => {
  it("allow a server-side call as an owner without two-factor", async () => {
    await createUser("owner")
    const target = await createUser("viewer")
    const cookie = await signIn("owner@example.com")

    const response = await getAuth().api.setRole({
      body: { userId: target.id, role: "editor" },
      headers: new Headers({ cookie }),
      asResponse: true,
    })

    expect(response.status).toBe(200)
  })

  it("cannot be dodged over HTTP with path variants", async () => {
    await createUser("owner")
    const target = await createUser("viewer")
    const cookie = await signInWithTwoFactor("owner@example.com")

    for (const path of [
      "/admin/set-role",
      "/admin/set-role/",
      "/ADMIN/set-role",
      "/admin/%73et-role",
      "/admin//set-role",
    ]) {
      const response = await app.request(`/api/auth${path}`, {
        method: "POST",
        headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ userId: target.id, role: "owner" }),
      })
      expect(response.status, path).not.toBe(200)
    }
    const [{ role }] = await getDb()
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, target.id))
    expect(role).toBe("viewer")
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

describe("signing in with two-factor on", () => {
  it.each(["owner", "editor"] as const)(
    "still challenges an %s, and the password alone gets no session",
    async (role) => {
      await createUser(role)
      const enrolled = await enrol(await signIn(`${role}@example.com`))

      const challenge = await getAuth().api.signInEmail({
        body: { email: `${role}@example.com`, password: PASSWORD },
        asResponse: true,
      })
      expect((await challenge.clone().json()).twoFactorRedirect).toBe(true)
      expect((await adminRequest("/me", cookieHeader(challenge))).status).toBe(
        401
      )

      const verified = await getAuth().api.verifyTOTP({
        body: { code: enrolled.totp.generate() },
        headers: new Headers({ cookie: cookieHeader(challenge) }),
        asResponse: true,
      })
      expect(verified.status).toBe(200)
      expect((await adminRequest("/me", cookieHeader(verified))).status).toBe(
        200
      )
    }
  )
})

// Only a completed sign-in is audited: never the password step alone.
describe("sign-in audit with two-factor", () => {
  const signIns = async () =>
    (
      await getDb()
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(eq(auditLogs.action, "auth.sign_in"))
    ).length

  it("logs the TOTP step, not the password step or enrolment", async () => {
    await createUser("owner")
    const enrolled = await enrol(await signIn("owner@example.com"))
    // The first, password-only sign-in, before two-factor existed.
    expect(await signIns()).toBe(1)

    const challenge = await getAuth().api.signInEmail({
      body: { email: "owner@example.com", password: PASSWORD },
      asResponse: true,
    })
    expect((await challenge.clone().json()).twoFactorRedirect).toBe(true)
    expect(await signIns()).toBe(1)

    const verified = await getAuth().api.verifyTOTP({
      body: { code: enrolled.totp.generate() },
      headers: new Headers({ cookie: cookieHeader(challenge) }),
      asResponse: true,
    })
    expect(verified.status).toBe(200)
    expect(await signIns()).toBe(2)
  })

  it("logs nothing for a wrong password", async () => {
    await createUser("owner")
    await getAuth()
      .api.signInEmail({
        body: { email: "owner@example.com", password: "wrong password!!" },
        asResponse: true,
      })
      .catch(() => undefined)
    expect(await signIns()).toBe(0)
  })
})

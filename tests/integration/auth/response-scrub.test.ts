import { TOTP } from "otpauth"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"
import { closeDb } from "@/server/db/client"

import {
  adminRequest,
  createUser,
  markTwoFactorEnabled,
  ORIGIN,
  PASSWORD,
  signIn,
  signInWithTwoFactor,
  viewAs,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

// Over HTTP through the app, as the browser calls Better Auth.
function http(path: string, cookie = "", body?: unknown) {
  return app.request(`/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie, origin: ORIGIN, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const cookieHeader = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((pair) => !pair.endsWith("="))
    .join("; ")

// No raw session token or IP address anywhere in the JSON.
async function expectScrubbed(response: Response) {
  const body = await response.clone().json()
  expect(body).not.toHaveProperty("token")
  if (body.session) {
    expect(body.session).not.toHaveProperty("token")
    expect(body.session).not.toHaveProperty("ipAddress")
    expect(body.session).not.toHaveProperty("userAgent")
  }
  return body
}

// The cookie the response set is a working session.
async function expectSignedIn(response: Response) {
  expect((await adminRequest("/me", cookieHeader(response))).status).toBe(200)
}

// An owner with real TOTP two-factor, and their backup codes.
async function enrolledOwner() {
  await createUser("owner")
  const cookie = await signIn("owner@example.com")
  const auth = getAuth()
  const enabled = await auth.api.enableTwoFactor({
    body: { password: PASSWORD },
    headers: new Headers({ cookie }),
  })
  if (enabled.method !== "totp") throw new Error("expected TOTP setup")
  const totp = new TOTP({
    secret: new URL(enabled.totpURI).searchParams.get("secret")!,
  })
  await auth.api.verifyTOTP({
    body: { code: totp.generate() },
    headers: new Headers({ cookie }),
  })
  return { totp, backupCodes: enabled.backupCodes }
}

// The password step of a two-factor sign-in: only a challenge cookie.
async function challenge() {
  const response = await http("/sign-in/email", "", {
    email: "owner@example.com",
    password: PASSWORD,
  })
  expect((await expectScrubbed(response)).twoFactorRedirect).toBe(true)
  return cookieHeader(response)
}

describe("Better Auth JSON over HTTP carries no session token or IP", () => {
  it("/sign-in/email, and its cookie still signs in", async () => {
    await createUser("editor")

    const response = await http("/sign-in/email", "", {
      email: "editor@example.com",
      password: PASSWORD,
    })

    expect(response.status).toBe(200)
    expect((await expectScrubbed(response)).user.email).toBe(
      "editor@example.com"
    )
    await expectSignedIn(response)
  })

  it("/two-factor/verify-totp, and its cookie still signs in", async () => {
    const { totp } = await enrolledOwner()

    const response = await http("/two-factor/verify-totp", await challenge(), {
      code: totp.generate(),
    })

    expect(response.status).toBe(200)
    await expectScrubbed(response)
    await expectSignedIn(response)
  })

  it("/two-factor/verify-backup-code, and its cookie still signs in", async () => {
    const { backupCodes } = await enrolledOwner()

    const response = await http(
      "/two-factor/verify-backup-code",
      await challenge(),
      { code: backupCodes[0] }
    )

    expect(response.status).toBe(200)
    await expectScrubbed(response)
    await expectSignedIn(response)
  })

  it("/get-session", async () => {
    await createUser("editor")
    const cookie = await signIn("editor@example.com")

    const response = await http("/get-session", cookie)

    expect(response.status).toBe(200)
    const body = await expectScrubbed(response)
    expect(body.session.id).toEqual(expect.any(String))
    expect(body.user.email).toBe("editor@example.com")
  })

  it("/change-password, and its rotated cookie still signs in", async () => {
    await createUser("editor")
    const cookie = await signIn("editor@example.com")

    const response = await http("/change-password", cookie, {
      currentPassword: PASSWORD,
      newPassword: "a brand new passphrase",
    })

    expect(response.status).toBe(200)
    await expectScrubbed(response)
    await expectSignedIn(response)
  })

  it("/admin/stop-impersonating, and the admin's cookie comes back", async () => {
    await createUser("owner")
    const editor = await createUser("editor")
    const owner = await signInWithTwoFactor("owner@example.com")
    await markTwoFactorEnabled("owner@example.com")
    const viewing = await viewAs(owner, editor.id)

    const response = await http("/admin/stop-impersonating", viewing, {})

    expect(response.status).toBe(200)
    await expectScrubbed(response)
    const me = await adminRequest("/me", cookieHeader(response))
    expect(me.status).toBe(200)
    expect((await me.json()).user.email).toBe("owner@example.com")
  })

  it("keeps the full body for server-side calls", async () => {
    await createUser("editor")
    const result = await getAuth().api.signInEmail({
      body: { email: "editor@example.com", password: PASSWORD },
    })
    expect(result.token).toEqual(expect.any(String))
  })
})

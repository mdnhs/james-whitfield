import { asc, eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, sessions, users } from "@/server/db/schema"

import {
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

// Over HTTP, as the Account page calls them: hooks see a real request.
function call(
  path: string,
  cookie: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST"
) {
  return getAuth().handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method,
      headers: {
        cookie,
        origin: ORIGIN,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  )
}

const tokensOf = async (userId: string) =>
  (
    await getDb()
      .select({ token: sessions.token })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(asc(sessions.createdAt))
  ).map((row) => row.token)

const accountRows = async () =>
  (await getDb().select().from(auditLogs)).filter(
    (row) => !row.action.startsWith("auth.")
  )

const nameOf = async (id: string) =>
  (await getDb().select().from(users).where(eq(users.id, id)))[0]

// Two signed-in devices for one editor: `laptop` signed in first.
async function editorOnTwoDevices() {
  const user = await createUser("editor")
  const laptop = await signIn("editor@example.com")
  const phone = await signIn("editor@example.com")
  const [laptopToken, phoneToken] = await tokensOf(user.id)
  return { user, laptop, phone, laptopToken, phoneToken }
}

// An owner viewing as the editor.
async function ownerViewingAsEditor() {
  const editor = await createUser("editor")
  await createUser("owner")
  const owner = await signInWithTwoFactor("owner@example.com")
  return { editor, cookie: await viewAs(owner, editor.id) }
}

describe("changing a password", () => {
  it("always signs the other devices out, audits it and returns no token", async () => {
    const { user, phone, laptopToken } = await editorOnTwoDevices()

    const response = await call("/change-password", phone, {
      currentPassword: PASSWORD,
      newPassword: "a brand new passphrase",
      revokeOtherSessions: false,
    })

    expect(response.status).toBe(200)
    expect(await response.json()).not.toHaveProperty("token")
    // The rotated session cookie still reaches the browser.
    expect(response.headers.get("set-cookie")).toMatch(/mk\.session_token=/)
    const remaining = await tokensOf(user.id)
    expect(remaining).toHaveLength(1)
    expect(remaining).not.toContain(laptopToken)
    const rows = await accountRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "account.password_change",
      actorId: user.id,
      entityType: "user",
      entityId: user.id,
    })
  })

  it("audits nothing when the current password is wrong", async () => {
    const { user, phone } = await editorOnTwoDevices()

    const response = await call("/change-password", phone, {
      currentPassword: "not the password at all",
      newPassword: "a brand new passphrase",
    })

    expect(response.status).toBe(400)
    expect(await tokensOf(user.id)).toHaveLength(2)
    expect(await accountRows()).toEqual([])
  })

  it("is refused during View-as", async () => {
    const { editor, cookie } = await ownerViewingAsEditor()

    const response = await call("/change-password", cookie, {
      currentPassword: PASSWORD,
      newPassword: "a brand new passphrase",
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      code: "IMPERSONATION_READ_ONLY",
    })
    expect(await accountRows()).toEqual([])
    // The editor's own password still works.
    await expect(signIn(editor.email)).resolves.toMatch(/mk\.session_token=/)
  })
})

describe("updating the profile", () => {
  it("saves a trimmed name and audits the change", async () => {
    const { user, phone } = await editorOnTwoDevices()

    const response = await call("/update-user", phone, { name: "  Eddie  " })

    expect(response.status).toBe(200)
    expect((await nameOf(user.id)).name).toBe("Eddie")
    const rows = await accountRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "account.profile_update",
      actorId: user.id,
      entityType: "user",
      entityId: user.id,
      diff: { name: { from: "editor", to: "Eddie" } },
    })
  })

  it.each([
    ["an empty name", { name: "   " }],
    ["an over-long name", { name: "x".repeat(81) }],
    ["an image", { name: "Ok", image: "https://example.com/me.png" }],
    ["any other key", { name: "Ok", role: "owner" }],
    ["no name", {}],
  ])("refuses %s", async (_label, body) => {
    const { user, phone } = await editorOnTwoDevices()

    const response = await call("/update-user", phone, body)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "INVALID_PROFILE" })
    const row = await nameOf(user.id)
    expect(row).toMatchObject({ name: "editor", image: null })
    expect(await accountRows()).toEqual([])
  })

  it("names the field and the rule that failed", async () => {
    const { phone } = await editorOnTwoDevices()

    const response = await call("/update-user", phone, {
      name: "x".repeat(81),
    })

    expect(await response.json()).toMatchObject({
      code: "INVALID_PROFILE",
      fieldErrors: { name: ["Use 80 characters or fewer"] },
    })
  })

  it("is refused during View-as", async () => {
    const { editor, cookie } = await ownerViewingAsEditor()

    const response = await call("/update-user", cookie, { name: "Hijacked" })

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      code: "IMPERSONATION_READ_ONLY",
    })
    expect((await nameOf(editor.id)).name).toBe("editor")
  })
})

describe("Better Auth's own session endpoints", () => {
  // Devices are managed through /api/v1/admin/account/sessions, which never
  // hands session tokens or IP addresses to the browser.
  it.each([
    ["/list-sessions", undefined],
    ["/revoke-session", { token: "x" }],
    ["/revoke-sessions", {}],
    ["/revoke-other-sessions", {}],
  ])("refuses %s over HTTP", async (path, body) => {
    const { user, phone } = await editorOnTwoDevices()

    const response = await call(path, phone, body)

    expect(response.status).toBe(403)
    expect(await response.json()).toMatchObject({
      code: "SESSION_ENDPOINT_DISABLED",
    })
    expect(await tokensOf(user.id)).toHaveLength(2)
  })

  it("never returns the session token from get-session", async () => {
    const { phone } = await editorOnTwoDevices()

    const response = await call("/get-session", phone)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.user.email).toBe("editor@example.com")
    expect(body.session.id).toEqual(expect.any(String))
    expect(body.session).not.toHaveProperty("token")
  })
})

// Like the Hono /account routes: an owner or admin without two-factor may
// set it up and nothing else (docs/brief.md §7.4).
describe("the two-factor rule on account changes", () => {
  const changes = [
    [
      "/change-password",
      { currentPassword: PASSWORD, newPassword: "a brand new passphrase" },
    ],
    ["/update-user", { name: "Renamed" }],
  ] as const

  describe.each(["owner", "admin"] as const)("an %s", (role) => {
    it.each(changes)("without two-factor is refused %s", async (path, body) => {
      const user = await createUser(role)
      const cookie = await signIn(`${role}@example.com`)

      const response = await call(path, cookie, body)

      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({
        code: "TWO_FACTOR_REQUIRED",
      })
      expect((await nameOf(user.id)).name).toBe(role)
      expect(await accountRows()).toEqual([])
      // The password is unchanged: it still signs in.
      expect(await signIn(`${role}@example.com`)).toMatch(/session_token=/)
    })

    it.each(changes)("with two-factor may call %s", async (path, body) => {
      await createUser(role)
      const cookie = await signIn(`${role}@example.com`)
      await markTwoFactorEnabled(`${role}@example.com`)

      expect((await call(path, cookie, body)).status).toBe(200)
    })
  })

  it.each(changes)(
    "does not ask other roles for two-factor on %s",
    async (path, body) => {
      await createUser("editor")
      const cookie = await signIn("editor@example.com")

      expect((await call(path, cookie, body)).status).toBe(200)
    }
  )
})

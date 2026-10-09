import { asc, eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, sessions } from "@/server/db/schema"

import { createUser, ORIGIN, PASSWORD, signIn } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

// Over HTTP, as the Account page calls them: hooks see a real request.
function post(path: string, cookie: string, body: unknown = {}) {
  return getAuth().handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: {
        cookie,
        origin: ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
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

// Two signed-in devices for one editor: `laptop` signed in first.
async function editorOnTwoDevices() {
  const user = await createUser("editor")
  const laptop = await signIn("editor@example.com")
  const phone = await signIn("editor@example.com")
  const [laptopToken, phoneToken] = await tokensOf(user.id)
  return { user, laptop, phone, laptopToken, phoneToken }
}

describe("changing a password", () => {
  it("always signs the other devices out and audits it", async () => {
    const { user, phone, laptopToken } = await editorOnTwoDevices()

    const response = await post("/change-password", phone, {
      currentPassword: PASSWORD,
      newPassword: "a brand new passphrase",
      revokeOtherSessions: false,
    })

    expect(response.status).toBe(200)
    const remaining = await tokensOf(user.id)
    expect(remaining).toHaveLength(1)
    expect(remaining).not.toContain(laptopToken)
    const rows = await accountRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "user.password_change",
      actorId: user.id,
      entityType: "user",
      entityId: user.id,
    })
  })

  it("audits nothing when the current password is wrong", async () => {
    const { user, phone } = await editorOnTwoDevices()

    const response = await post("/change-password", phone, {
      currentPassword: "not the password at all",
      newPassword: "a brand new passphrase",
    })

    expect(response.status).toBe(400)
    expect(await tokensOf(user.id)).toHaveLength(2)
    expect(await accountRows()).toEqual([])
  })
})

describe("revoking a session", () => {
  it("signs another of the user's devices out and audits it", async () => {
    const { user, phone, laptopToken, phoneToken } = await editorOnTwoDevices()

    const response = await post("/revoke-session", phone, {
      token: laptopToken,
    })

    expect(response.status).toBe(200)
    expect(await tokensOf(user.id)).toEqual([phoneToken])
    const rows = await accountRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "session.revoke",
      actorId: user.id,
      entityType: "session",
    })
    // The audit row never stores the session token.
    expect(JSON.stringify(rows[0])).not.toContain(laptopToken)
  })

  it("refuses the current session (that is signing out)", async () => {
    const { user, phone, phoneToken } = await editorOnTwoDevices()

    const response = await post("/revoke-session", phone, {
      token: phoneToken,
    })

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: "CURRENT_SESSION" })
    expect(await tokensOf(user.id)).toHaveLength(2)
    expect(await accountRows()).toEqual([])
  })

  it("refuses another user's session", async () => {
    const { phone } = await editorOnTwoDevices()
    const other = await createUser("viewer")
    await signIn("viewer@example.com")
    const [otherToken] = await tokensOf(other.id)

    const response = await post("/revoke-session", phone, {
      token: otherToken,
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ code: "SESSION_NOT_FOUND" })
    expect(await tokensOf(other.id)).toEqual([otherToken])
    expect(await accountRows()).toEqual([])
  })

  it("audits signing out every other device", async () => {
    const { user, phone, phoneToken } = await editorOnTwoDevices()

    const response = await post("/revoke-other-sessions", phone)

    expect(response.status).toBe(200)
    expect(await tokensOf(user.id)).toEqual([phoneToken])
    const rows = await accountRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "session.revoke",
      actorId: user.id,
      entityType: "session",
    })
  })
})

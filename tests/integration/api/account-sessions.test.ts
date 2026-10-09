import { asc, eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, sessions } from "@/server/db/schema"

import {
  adminRequest,
  createUser,
  signIn,
  signInWithTwoFactor,
  viewAs,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

const DAY = 24 * 3_600_000

const sessionsOf = (userId: string) =>
  getDb()
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(asc(sessions.createdAt))

const accountRows = async () =>
  (await getDb().select().from(auditLogs)).filter(
    (row) => !row.action.startsWith("auth.")
  )

// Two signed-in devices for one editor: `laptop` signed in first.
async function editorOnTwoDevices() {
  const user = await createUser("editor")
  const laptop = await signIn("editor@example.com")
  const phone = await signIn("editor@example.com")
  const [laptopRow, phoneRow] = await sessionsOf(user.id)
  return { user, laptop, phone, laptopRow: laptopRow!, phoneRow: phoneRow! }
}

const list = async (cookie: string) => {
  const response = await adminRequest("/account/sessions", cookie)
  expect(response.status).toBe(200)
  return (await response.json()) as {
    id: string
    device: string
    lastActiveAt: string
    current: boolean
  }[]
}

describe("GET /api/v1/admin/account/sessions", () => {
  it("lists the user's devices, this one first, with no token or IP", async () => {
    const { phone, laptopRow, phoneRow } = await editorOnTwoDevices()

    const items = await list(phone)

    expect(items.map((item) => [item.id, item.current])).toEqual([
      [phoneRow.id, true],
      [laptopRow.id, false],
    ])
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual([
        "current",
        "device",
        "id",
        "lastActiveAt",
      ])
    }
    const raw = JSON.stringify(items)
    expect(raw).not.toContain(phoneRow.token)
    expect(raw).not.toContain(laptopRow.token)
  })

  // Better Auth's /list-sessions answers 403 SESSION_NOT_FRESH once the
  // session is a day old; a week-long session must still see its devices.
  it("works for a session signed in days ago", async () => {
    const { user, phone } = await editorOnTwoDevices()
    await getDb()
      .update(sessions)
      .set({ createdAt: new Date(Date.now() - 2 * DAY) })
      .where(eq(sessions.userId, user.id))

    expect(await list(phone)).toHaveLength(2)
  })

  it("leaves out expired sessions and other people's", async () => {
    const { user, phone, laptopRow } = await editorOnTwoDevices()
    await createUser("viewer")
    await signIn("viewer@example.com")
    await getDb()
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.id, laptopRow.id))

    const items = await list(phone)

    expect(items).toHaveLength(1)
    expect(items[0]!.current).toBe(true)
    expect((await sessionsOf(user.id)).length).toBe(2)
  })
})

describe("DELETE /api/v1/admin/account/sessions/:id", () => {
  it("signs another of the user's devices out and audits it by id", async () => {
    const { user, phone, laptop, laptopRow, phoneRow } =
      await editorOnTwoDevices()

    const response = await adminRequest(
      `/account/sessions/${laptopRow.id}`,
      phone,
      { method: "DELETE" }
    )

    expect(response.status).toBe(200)
    expect((await sessionsOf(user.id)).map((row) => row.id)).toEqual([
      phoneRow.id,
    ])
    expect((await adminRequest("/me", laptop)).status).toBe(401)
    const rows = await accountRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "account.session_revoke",
      actorId: user.id,
      entityType: "session",
      entityId: laptopRow.id,
    })
    expect(JSON.stringify(rows[0])).not.toContain(laptopRow.token)
  })

  it("refuses the current session (that is signing out)", async () => {
    const { user, phone, phoneRow } = await editorOnTwoDevices()

    const response = await adminRequest(
      `/account/sessions/${phoneRow.id}`,
      phone,
      { method: "DELETE" }
    )

    expect(response.status).toBe(400)
    expect((await sessionsOf(user.id)).length).toBe(2)
    expect(await accountRows()).toEqual([])
  })

  it("answers 404 for another user's session or an unknown id", async () => {
    const { phone } = await editorOnTwoDevices()
    const other = await createUser("viewer")
    await signIn("viewer@example.com")
    const [otherRow] = await sessionsOf(other.id)

    for (const id of [otherRow!.id, crypto.randomUUID()]) {
      const response = await adminRequest(`/account/sessions/${id}`, phone, {
        method: "DELETE",
      })
      expect(response.status).toBe(404)
    }
    expect(await sessionsOf(other.id)).toHaveLength(1)
    expect(await accountRows()).toEqual([])
  })

  it("validates the id", async () => {
    const { phone } = await editorOnTwoDevices()
    const response = await adminRequest("/account/sessions/nope", phone, {
      method: "DELETE",
    })
    expect(response.status).toBe(400)
  })
})

describe("POST /api/v1/admin/account/sessions/revoke-others", () => {
  it("signs every other device out and audits it once", async () => {
    const { user, phone, phoneRow } = await editorOnTwoDevices()
    await signIn("editor@example.com")

    const response = await adminRequest(
      "/account/sessions/revoke-others",
      phone,
      { method: "POST" }
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ revoked: 2 })
    expect((await sessionsOf(user.id)).map((row) => row.id)).toEqual([
      phoneRow.id,
    ])
    const rows = await accountRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "account.session_revoke",
      actorId: user.id,
      entityType: "session",
      entityId: null,
    })
  })

  it("writes no audit row when there was nothing to sign out", async () => {
    await createUser("editor")
    const only = await signIn("editor@example.com")

    const response = await adminRequest(
      "/account/sessions/revoke-others",
      only,
      {
        method: "POST",
      }
    )

    expect(await response.json()).toEqual({ revoked: 0 })
    expect(await accountRows()).toEqual([])
  })
})

describe("during View-as", () => {
  it("refuses every account route", async () => {
    const editor = await createUser("editor")
    await createUser("owner")
    await signIn("editor@example.com")
    const owner = await signInWithTwoFactor("owner@example.com")
    const cookie = await viewAs(owner, editor.id)
    const [editorRow] = await sessionsOf(editor.id)

    for (const [path, method] of [
      ["/account/sessions", "GET"],
      [`/account/sessions/${editorRow!.id}`, "DELETE"],
      ["/account/sessions/revoke-others", "POST"],
    ] as const) {
      const response = await adminRequest(path, cookie, { method })
      expect(response.status).toBe(403)
      expect((await response.json()).error.code).toBe("IMPERSONATION_READ_ONLY")
    }
    expect(
      (await sessionsOf(editor.id)).filter((row) => !row.impersonatedBy)
    ).toHaveLength(1)
  })
})

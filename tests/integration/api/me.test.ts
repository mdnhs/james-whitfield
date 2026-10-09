import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { sessions, users } from "@/server/db/schema"

import {
  adminRequest,
  createUser,
  ORIGIN,
  signIn,
  signInWithTwoFactor,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("GET /api/v1/admin/me", () => {
  it("rejects anonymous requests with 401", async () => {
    const response = await adminRequest("/me", "")
    expect(response.status).toBe(401)
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED")
  })

  it("returns the actor's roles and merged permissions", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")

    const response = await adminRequest("/me", cookie)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.roles).toEqual(["viewer"])
    expect(body.permissions.page).toEqual(["read"])
    expect(body.permissions.lead).toBeUndefined()
  })

  it("reflects a role change on the very next request despite the cookie cache", async () => {
    await createUser("editor")
    const cookie = await signIn("editor@example.com")
    await getDb()
      .update(users)
      .set({ role: "viewer" })
      .where(eq(users.email, "editor@example.com"))

    const body = await (await adminRequest("/me", cookie)).json()

    expect(body.roles).toEqual(["viewer"])
  })

  it("locks out a banned user immediately", async () => {
    await createUser("owner")
    const target = await createUser("viewer")
    const ownerCookie = await signInWithTwoFactor("owner@example.com")
    const viewerCookie = await signIn("viewer@example.com")

    await getAuth().api.banUser({
      body: { userId: target.id, banReason: "test" },
      headers: new Headers({ cookie: ownerCookie }),
    })

    expect((await adminRequest("/me", viewerCookie)).status).toBe(401)
  })

  it("treats banned=true set directly in the database as signed out", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")
    await getDb()
      .update(users)
      .set({ banned: true })
      .where(eq(users.email, "viewer@example.com"))

    expect((await adminRequest("/me", cookie)).status).toBe(401)
  })

  it("keeps a user signed in once their ban has expired", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")
    await getDb()
      .update(users)
      .set({ banned: true, banExpires: new Date(Date.now() - 60_000) })
      .where(eq(users.email, "viewer@example.com"))

    expect((await adminRequest("/me", cookie)).status).toBe(200)
  })

  it("forwards a refreshed session cookie", async () => {
    const user = await createUser("viewer")
    const cookie = await signIn("viewer@example.com")
    // Aging the session past updateAge (1 day) makes the next read refresh it.
    await getDb()
      .update(sessions)
      .set({ updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
      .where(eq(sessions.userId, user.id))
    const response = await adminRequest("/me", cookie)

    expect(response.status).toBe(200)
    expect(response.headers.getSetCookie().join(";")).toContain("mk.session_")
  })
})

describe("sameOrigin on mutating admin routes", () => {
  async function post(headers: Record<string, string>) {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")
    return app.request("/api/v1/admin/__nope", {
      method: "POST",
      headers: { cookie, "content-type": "application/json", ...headers },
      body: "{}",
    })
  }

  it("rejects a foreign Origin", async () => {
    expect((await post({ origin: "https://evil.example" })).status).toBe(403)
  })
  it("rejects Origin: null", async () => {
    expect((await post({ origin: "null" })).status).toBe(403)
  })
  it("rejects a missing Origin", async () => {
    expect((await post({})).status).toBe(403)
  })
  it("rejects cross-site Sec-Fetch-Site without Origin", async () => {
    expect((await post({ "sec-fetch-site": "cross-site" })).status).toBe(403)
  })
  it("allows the same origin through to routing", async () => {
    expect((await post({ origin: ORIGIN })).status).toBe(404)
  })
})

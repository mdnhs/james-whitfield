import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"

import { adminRequest, createUser, signIn } from "../helpers/auth"
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
    const ownerCookie = await signIn("owner@example.com")
    const viewerCookie = await signIn("viewer@example.com")

    await getAuth().api.banUser({
      body: { userId: target.id, banReason: "test" },
      headers: new Headers({ cookie: ownerCookie }),
    })

    expect((await adminRequest("/me", viewerCookie)).status).toBe(401)
  })
})

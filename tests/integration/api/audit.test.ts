import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb } from "@/server/db/client"

import { adminRequest, createUser, signIn } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("GET /api/v1/admin/audit", () => {
  it("is forbidden without audit.read", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")
    expect((await adminRequest("/audit", cookie)).status).toBe(403)
  })

  it("lists sign-ins newest first for an owner", async () => {
    await createUser("owner")
    await createUser("editor")
    await signIn("editor@example.com")
    const cookie = await signIn("owner@example.com")

    const response = await adminRequest("/audit?page=1&pageSize=10", cookie)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.total).toBe(2)
    expect(body.items.map((item: { action: string }) => item.action)).toEqual([
      "auth.sign_in",
      "auth.sign_in",
    ])
    expect(new Date(body.items[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(body.items[1].createdAt).getTime()
    )
  })

  it("validates paging input", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")
    const response = await adminRequest("/audit?pageSize=500", cookie)
    expect(response.status).toBe(400)
    expect((await response.json()).error.fieldErrors.pageSize).toBeDefined()
  })
})

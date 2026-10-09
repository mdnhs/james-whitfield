import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb } from "@/server/db/client"

import {
  adminRequest,
  createUser,
  signIn,
  signInWithTwoFactor,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

async function search(cookie: string, q: string) {
  const response = await adminRequest(
    `/search?q=${encodeURIComponent(q)}`,
    cookie
  )
  return { status: response.status, body: await response.json() }
}

describe("GET /api/v1/admin/search", () => {
  it("answers with the caller's own destinations only", async () => {
    await createUser("intake")
    const cookie = await signIn("intake@example.com")
    const { status, body } = await search(cookie, "")
    expect(status).toBe(200)
    const hrefs = body.items.map((hit: { href: string }) => hit.href)
    expect(hrefs).toContain("/admin/leads")
    expect(hrefs).not.toContain("/admin/pages")
    expect(hrefs).not.toContain("/admin/users")
  })

  it("finds Users & roles for an owner by keyword", async () => {
    await createUser("owner")
    const cookie = await signInWithTwoFactor("owner@example.com")
    const { body } = await search(cookie, "invite")
    expect(body.items).toContainEqual(
      expect.objectContaining({ href: "/admin/users", label: "Users & roles" })
    )
  })

  it("rejects an over-long query", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")
    const { status, body } = await search(cookie, "x".repeat(101))
    expect(status).toBe(400)
    expect(body.error.code).toBe("VALIDATION_FAILED")
  })
})

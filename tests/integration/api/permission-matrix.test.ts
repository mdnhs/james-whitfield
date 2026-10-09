import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
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

async function cookieFor(role: RoleName) {
  await createUser(role)
  const email = `${role}@example.com`
  return role === "owner" || role === "admin"
    ? signInWithTwoFactor(email)
    : signIn(email)
}

// Written out from docs/brief.md §7.2 rather than derived from the role
// definitions, so drift between code and spec fails here. 400 on invite
// means "past can(), stopped by validation" (the body is empty).
const MATRIX: Record<RoleName, { audit: number; invite: number }> = {
  owner: { audit: 200, invite: 400 },
  admin: { audit: 200, invite: 400 },
  editor: { audit: 403, invite: 403 },
  author: { audit: 403, invite: 403 },
  marketer: { audit: 403, invite: 403 },
  intake: { audit: 403, invite: 403 },
  viewer: { audit: 403, invite: 403 },
}

describe.each(ROLE_NAMES)("can() for %s", (role) => {
  it(`GET /audit → ${MATRIX[role].audit}`, async () => {
    const response = await adminRequest("/audit", await cookieFor(role))
    expect(response.status).toBe(MATRIX[role].audit)
    if (response.status === 403) {
      expect((await response.json()).error.code).toBe("FORBIDDEN")
    }
  })

  it(`POST /users/invite → ${MATRIX[role].invite}`, async () => {
    const response = await adminRequest(
      "/users/invite",
      await cookieFor(role),
      { method: "POST", body: {} }
    )
    expect(response.status).toBe(MATRIX[role].invite)
  })
})

describe("can() without a session", () => {
  it.each(["/me", "/audit"])("GET %s → 401", async (path) => {
    expect((await adminRequest(path, "")).status).toBe(401)
  })
})

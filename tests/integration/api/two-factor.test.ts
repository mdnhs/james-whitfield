import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb } from "@/server/db/client"

import {
  adminRequest,
  createUser,
  markTwoFactorEnabled,
  signIn,
} from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

// docs/brief.md §7.4: owners and admins must use two-factor. The panel
// redirects them to setup; the API itself refuses them too.
describe("two-factor enforcement on the admin API", () => {
  it.each(["owner", "admin"] as const)(
    "refuses an %s without two-factor beyond /me",
    async (role) => {
      await createUser(role)
      const cookie = await signIn(`${role}@example.com`)

      const response = await adminRequest("/audit", cookie)

      expect(response.status).toBe(403)
      expect((await response.json()).error.code).toBe("TWO_FACTOR_REQUIRED")
    }
  )

  it("refuses mutations too", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")

    const response = await adminRequest("/users/invite", cookie, {
      method: "POST",
      body: { email: "new@example.com", name: "New", role: "editor" },
    })

    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe("TWO_FACTOR_REQUIRED")
  })

  it("still answers /me, so the client can send them to setup", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")

    const response = await adminRequest("/me", cookie)

    expect(response.status).toBe(200)
    expect((await response.json()).twoFactorEnabled).toBe(false)
  })

  it("lets an owner through once two-factor is on", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")
    await markTwoFactorEnabled("owner@example.com")

    expect((await adminRequest("/audit", cookie)).status).toBe(200)
  })

  it("does not require two-factor for other roles", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")

    // Past the 2FA check: the role check is what refuses a viewer here.
    const response = await adminRequest("/audit", cookie)
    expect((await response.json()).error.code).toBe("FORBIDDEN")
  })
})

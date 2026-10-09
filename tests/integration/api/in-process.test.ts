import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { inProcessAuditApi } from "@/server/api/in-process"
import { closeDb } from "@/server/db/client"

import { createUser, signIn, signInWithTwoFactor } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

describe("inProcessAuditApi", () => {
  it("returns exactly the JSON the browser would get", async () => {
    await createUser("owner")
    const cookie = await signInWithTwoFactor("owner@example.com")
    const page = await parseResponse(
      inProcessAuditApi(cookie).index.$get({
        query: { page: "1", pageSize: "5" },
      })
    )
    expect(page).toMatchObject({ page: 1, pageSize: 5 })
    expect(page.items.length).toBeGreaterThan(0)
    // Serialised like the HTTP response: ISO strings, not Date objects.
    expect(typeof page.items[0].createdAt).toBe("string")
  })

  it("goes through the same authorisation", async () => {
    await createUser("viewer")
    const cookie = await signIn("viewer@example.com")
    const error = await parseResponse(
      inProcessAuditApi(cookie).index.$get({ query: {} })
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: "FORBIDDEN", status: 403 })
  })
})

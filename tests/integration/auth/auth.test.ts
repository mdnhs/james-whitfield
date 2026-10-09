import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { getAuth } from "@/server/auth/auth"
import { closeDb } from "@/server/db/client"

import { resetDb } from "../helpers/db"

const PASSWORD = "correct horse battery staple"

beforeEach(resetDb)
afterAll(closeDb)

describe("Better Auth", () => {
  it("lets a created user sign in with email and password", async () => {
    const auth = getAuth()
    await auth.api.createUser({
      body: {
        email: "editor@example.com",
        password: PASSWORD,
        name: "Ed Itor",
        role: "editor",
      },
    })

    const response = await auth.api.signInEmail({
      body: { email: "editor@example.com", password: PASSWORD },
      asResponse: true,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("set-cookie")).toMatch(/mk\.session_token=/)
  })

  it("stores uuid ids", async () => {
    const { user } = await getAuth().api.createUser({
      body: {
        email: "viewer@example.com",
        password: PASSWORD,
        name: "Vi",
        role: "viewer",
      },
    })
    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it("rejects public sign-up", async () => {
    const response = await getAuth().handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: "x@example.com",
          password: PASSWORD,
          name: "X",
        }),
      })
    )
    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})

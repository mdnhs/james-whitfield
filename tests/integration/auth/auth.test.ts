import { sql } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { getAuth } from "@/server/auth/auth"
import { closeDb, getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"

import { resetDb } from "../helpers/db"

const templates = vi.hoisted(() => ({ throws: false }))

vi.mock("@/server/lib/email/templates", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/server/lib/email/templates")>()
  return {
    ...original,
    passwordResetEmail: (
      ...args: Parameters<typeof original.passwordResetEmail>
    ) => {
      if (templates.throws) throw new Error("template exploded")
      return original.passwordResetEmail(...args)
    },
  }
})

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

  it("rejects public sign-up and creates no user", async () => {
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
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
    })
    expect(await getDb().select().from(users)).toHaveLength(0)
  })

  it("stores every auth timestamp as timestamptz", async () => {
    const { rows } = await getDb().execute<{
      table_name: string
      column_name: string
      data_type: string
    }>(sql`
      select table_name, column_name, data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('users', 'sessions', 'accounts', 'verifications', 'two_factors', 'rate_limits')
        and data_type like 'timestamp%'
    `)
    expect(rows.length).toBeGreaterThan(0)
    expect(
      rows.filter((row) => row.data_type !== "timestamp with time zone")
    ).toEqual([])
  })

  describe("password reset when the template throws", () => {
    const requestReset = (email: string) =>
      getAuth().handler(
        new Request("http://localhost:3000/api/auth/request-password-reset", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({ email, redirectTo: "/admin/reset-password" }),
        })
      )

    it("answers identically for existing and unknown emails", async () => {
      await getAuth().api.createUser({
        body: {
          email: "real@example.com",
          password: PASSWORD,
          name: "Real",
          role: "editor",
        },
      })
      templates.throws = true
      try {
        const known = await requestReset("real@example.com")
        const unknown = await requestReset("nobody@example.com")
        expect(known.status).toBe(200)
        expect(unknown.status).toBe(known.status)
        expect(await known.json()).toEqual(await unknown.json())
      } finally {
        templates.throws = false
      }
    })
  })
})

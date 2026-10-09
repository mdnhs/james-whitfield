import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest"

import { closeDb } from "@/server/db/client"
import { clearOutbox, readOutbox } from "@/server/lib/email"

import { adminRequest, createUser, signIn } from "../helpers/auth"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterEach(clearOutbox)
afterAll(closeDb)

const invite = (cookie: string, body: unknown, origin?: string) =>
  adminRequest("/users/invite", cookie, { method: "POST", body, origin })

describe("POST /api/v1/admin/users/invite", () => {
  it("lets an owner invite an admin and emails a set-password link", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")

    const response = await invite(cookie, {
      email: "  New.Admin@Example.com ",
      name: "Nia",
      role: "admin",
    })

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      email: "new.admin@example.com",
      role: "admin",
    })
    const [message] = readOutbox()
    expect(message.to).toBe("new.admin@example.com")
    expect(message.subject).toBe("You're invited to the Magda Kennedy admin")
    expect(message.text).toContain("/reset-password/")
  })

  it("does not let an admin invite an owner", async () => {
    await createUser("admin")
    const cookie = await signIn("admin@example.com")
    const response = await invite(cookie, {
      email: "x@example.com",
      name: "X",
      role: "owner",
    })
    expect(response.status).toBe(403)
  })

  it("is forbidden for an editor", async () => {
    await createUser("editor")
    const cookie = await signIn("editor@example.com")
    const response = await invite(cookie, {
      email: "x@example.com",
      name: "X",
      role: "viewer",
    })
    expect(response.status).toBe(403)
  })

  it("treats emails case-insensitively when checking for duplicates", async () => {
    await createUser("owner")
    await createUser("editor", "editor@example.com")
    const cookie = await signIn("owner@example.com")
    const response = await invite(cookie, {
      email: "Editor@Example.com",
      name: "Dup",
      role: "viewer",
    })
    expect(response.status).toBe(409)
  })

  it("rejects a cross-site request even with a valid session", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")
    const response = await invite(
      cookie,
      { email: "x@example.com", name: "X", role: "viewer" },
      "https://evil.example"
    )
    expect(response.status).toBe(403)
  })

  it("returns field errors for invalid input", async () => {
    await createUser("owner")
    const cookie = await signIn("owner@example.com")
    const response = await invite(cookie, {
      email: "nope",
      name: "",
      role: "chief",
    })
    expect(response.status).toBe(400)
    const { error } = await response.json()
    expect(Object.keys(error.fieldErrors).sort()).toEqual([
      "email",
      "name",
      "role",
    ])
  })
})

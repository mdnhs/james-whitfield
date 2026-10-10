import { beforeEach, describe, expect, it, vi } from "vitest"

import type { SessionLike } from "./actor"

const requestHeaders = new Headers()
let current: SessionLike | null = null

vi.mock("next/headers", () => ({ headers: async () => requestHeaders }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock("./fresh-session", () => ({
  getFreshSession: async () => ({ session: current, setCookies: [] }),
}))

const { requireActor, requirePermission } = await import("./session")

const signedInAs = (role: string, twoFactorEnabled: boolean): SessionLike => ({
  user: {
    id: "u1",
    email: `${role}@example.com`,
    name: role,
    role,
    twoFactorEnabled,
  },
  session: { id: "s1" },
})

describe("requireActor when signed out", () => {
  beforeEach(() => {
    current = null
    requestHeaders.delete("x-mk-admin-path")
  })

  it("returns to the path the proxy saw", async () => {
    requestHeaders.set("x-mk-admin-path", "/admin/pages?tab=draft")
    await expect(requireActor()).rejects.toThrow(
      "REDIRECT /admin/sign-in?next=%2Fadmin%2Fpages%3Ftab%3Ddraft"
    )
  })

  it("prefers an explicit next", async () => {
    requestHeaders.set("x-mk-admin-path", "/admin/pages")
    await expect(requireActor("/admin/two-factor-setup")).rejects.toThrow(
      "REDIRECT /admin/sign-in?next=%2Fadmin%2Ftwo-factor-setup"
    )
  })

  it("falls back to /admin for a missing or unsafe path", async () => {
    await expect(requireActor()).rejects.toThrow(
      "REDIRECT /admin/sign-in?next=%2Fadmin"
    )
    requestHeaders.set("x-mk-admin-path", "//evil.example")
    await expect(requireActor()).rejects.toThrow(
      "REDIRECT /admin/sign-in?next=%2Fadmin"
    )
  })
})

// Change 2026-10-11: two-factor is optional for every role.
describe("no forced two-factor setup", () => {
  it.each(["owner", "editor,admin", "editor"])(
    "lets %s without two-factor through, with no redirect",
    async (role) => {
      current = signedInAs(role, false)
      await expect(requireActor()).resolves.toMatchObject({
        twoFactorEnabled: false,
      })
    }
  )

  it("lets an owner with two-factor through", async () => {
    current = signedInAs("owner", true)
    await expect(requireActor()).resolves.toMatchObject({ roles: ["owner"] })
  })
})

describe("requirePermission", () => {
  beforeEach(() => {
    requestHeaders.delete("x-mk-admin-path")
  })

  it("returns the actor when a role grants the permission", async () => {
    current = signedInAs("viewer", false)
    await expect(requirePermission({ page: ["read"] })).resolves.toMatchObject({
      roles: ["viewer"],
    })
  })

  it("sends a role without it to the no-access screen, remembering where", async () => {
    current = signedInAs("viewer", false)
    requestHeaders.set("x-mk-admin-path", "/admin/leads?tab=new")
    await expect(requirePermission({ lead: ["read"] })).rejects.toThrow(
      "REDIRECT /admin/no-access?from=%2Fadmin%2Fleads%3Ftab%3Dnew"
    )
  })

  it("never echoes an unsafe path into the no-access link", async () => {
    current = signedInAs("viewer", false)
    requestHeaders.set("x-mk-admin-path", "//evil.example")
    await expect(requirePermission({ lead: ["read"] })).rejects.toThrow(
      "REDIRECT /admin/no-access?from=%2Fadmin"
    )
  })

  it("still enforces sign-in first, but never two-factor setup", async () => {
    current = null
    await expect(requirePermission({ page: ["read"] })).rejects.toThrow(
      /^REDIRECT \/admin\/sign-in/
    )
    current = signedInAs("owner", false)
    await expect(requirePermission({ page: ["read"] })).resolves.toMatchObject({
      roles: ["owner"],
    })
  })
})

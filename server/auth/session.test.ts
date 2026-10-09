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

const { requireActor, requireSignedIn } = await import("./session")

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

describe("two-factor enforcement (brief §7.4)", () => {
  it("sends an owner without two-factor to setup", async () => {
    current = signedInAs("owner", false)
    await expect(requireActor()).rejects.toThrow(
      "REDIRECT /admin/two-factor-setup"
    )
  })

  it("sends an admin without two-factor to setup", async () => {
    current = signedInAs("editor,admin", false)
    await expect(requireActor()).rejects.toThrow(
      "REDIRECT /admin/two-factor-setup"
    )
  })

  it("lets an owner with two-factor through", async () => {
    current = signedInAs("owner", true)
    await expect(requireActor()).resolves.toMatchObject({ roles: ["owner"] })
  })

  it("does not force two-factor on other roles", async () => {
    current = signedInAs("editor", false)
    await expect(requireActor()).resolves.toMatchObject({ roles: ["editor"] })
  })

  it("lets the setup screen through without two-factor", async () => {
    current = signedInAs("owner", false)
    await expect(requireSignedIn()).resolves.toMatchObject({
      twoFactorEnabled: false,
    })
  })
})

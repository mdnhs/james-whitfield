import { beforeEach, describe, expect, it, vi } from "vitest"

const requestHeaders = new Headers()
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`)
  },
}))
vi.mock("./fresh-session", () => ({
  getFreshSession: async () => ({ session: null, setCookies: [] }),
}))

const { requireActor } = await import("./session")

describe("requireActor when signed out", () => {
  beforeEach(() => requestHeaders.delete("x-mk-admin-path"))

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

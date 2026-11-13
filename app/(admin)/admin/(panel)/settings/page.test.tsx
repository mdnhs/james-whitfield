import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RoleName } from "@/lib/auth/permissions"

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`)
})
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND")
})
const requireActor = vi.fn(async () => ({
  id: "u1",
  roles: ["owner"] as RoleName[],
}))

vi.mock("next/navigation", () => ({ redirect, notFound }))
vi.mock("@/server/auth/session", () => ({ requireActor }))

const { default: SettingsIndex } = await import("./page")

// The page suspends on one async child: run it as React would.
const go = () => {
  const page = SettingsIndex() as ReactElement<{ children: ReactElement }>
  return (page.props.children.type as () => Promise<never>)()
}
const as = (...roles: RoleName[]) =>
  requireActor.mockResolvedValueOnce({ id: "u1", roles })

describe("/admin/settings", () => {
  beforeEach(() => vi.clearAllMocks())

  it("signs the visitor in, then opens Identity for an owner", async () => {
    await expect(go()).rejects.toThrow("NEXT_REDIRECT /admin/settings/identity")
    expect(requireActor).toHaveBeenCalledWith("/admin/settings")
  })

  it("opens the first page a globals-only role may read", async () => {
    as("editor")
    await expect(go()).rejects.toThrow("NEXT_REDIRECT /admin/settings/contact")
  })

  it("is a 404 for a role with no settings page", async () => {
    as("intake")
    await expect(go()).rejects.toThrow("NEXT_NOT_FOUND")
    expect(redirect).not.toHaveBeenCalled()
  })
})

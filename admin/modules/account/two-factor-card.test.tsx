// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

const generateBackupCodes = vi.fn<(body: unknown) => Promise<unknown>>(
  async () => ({
    data: { backupCodes: ["aaaaa-11111", "bbbbb-22222"] },
    error: null,
  })
)
const disable = vi.fn<(body: unknown) => Promise<unknown>>(async () => ({
  data: { status: true },
  error: null,
}))
vi.mock("@/admin/lib/auth-client", () => ({
  authClient: {
    twoFactor: {
      generateBackupCodes: (b: unknown) => generateBackupCodes(b),
      disable: (b: unknown) => disable(b),
    },
  },
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { TwoFactorCard } from "./two-factor-card"

const actor = (roles: MePayload["roles"], on = true): MePayload => ({
  user: { id: "u", email: "u@example.com", name: "U" },
  roles,
  permissions: {},
  twoFactorEnabled: on,
  impersonatedBy: null,
})

const renderAs = (me: MePayload) =>
  render(
    <AdminActorProvider value={me}>
      <TwoFactorCard />
    </AdminActorProvider>
  )

afterEach(cleanup)

describe("TwoFactorCard", () => {
  it("lets an owner turn it off with their password", async () => {
    renderAs(actor(["owner"]))
    await userEvent.click(screen.getByRole("button", { name: "Turn off" }))
    expect(
      screen.getByText(/keeping it on is strongly recommended/)
    ).toBeTruthy()
    await userEvent.type(screen.getByLabelText("Password"), "a long password!")
    await userEvent.click(
      screen.getByRole("button", { name: "Turn off two-factor" })
    )
    expect(disable).toHaveBeenCalledWith({ password: "a long password!" })
  })

  it("shows new backup codes once, after the password", async () => {
    renderAs(actor(["editor"]))
    await userEvent.click(
      screen.getByRole("button", { name: "New backup codes" })
    )
    await userEvent.type(screen.getByLabelText("Password"), "a long password!")
    await userEvent.click(screen.getByRole("button", { name: "Generate" }))
    expect(generateBackupCodes).toHaveBeenCalledWith({
      password: "a long password!",
    })
    expect(await screen.findByText("aaaaa-11111")).toBeTruthy()
  })

  it("lets an editor turn it off with their password", async () => {
    renderAs(actor(["editor"]))
    await userEvent.click(screen.getByRole("button", { name: "Turn off" }))
    await userEvent.type(screen.getByLabelText("Password"), "a long password!")
    await userEvent.click(
      screen.getByRole("button", { name: "Turn off two-factor" })
    )
    expect(disable).toHaveBeenCalledWith({ password: "a long password!" })
  })

  it("offers setup when it is off", () => {
    renderAs(actor(["editor"], false))
    expect(
      screen
        .getByRole("link", { name: "Set up two-factor" })
        .getAttribute("href")
    ).toBe("/admin/two-factor-setup")
    expect(screen.queryByText(/Strongly recommended for your role/)).toBeNull()
  })

  it("gives an owner without it the reason, without blocking", () => {
    renderAs(actor(["owner"], false))
    expect(screen.getByText(/Strongly recommended for your role/)).toBeTruthy()
    expect(screen.getByRole("link", { name: "Set up two-factor" })).toBeTruthy()
  })
})

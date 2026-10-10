// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"
import { permissionMap, type RoleName } from "@/lib/auth/permissions"

import { UsersTable } from "./users-table"

const me = (id: string, roles: RoleName[]): MePayload => ({
  user: { id, email: `${id}@example.com`, name: id },
  roles,
  permissions: permissionMap(roles),
  twoFactorEnabled: true,
  impersonatedBy: null,
})

const row = (id: string, roles: RoleName[], extra = {}) => ({
  id,
  name: `Person ${id}`,
  email: `${id}@example.com`,
  roles,
  twoFactorEnabled: true,
  banned: false,
  banReason: null,
  banExpires: null,
  invitePending: false,
  lastActiveAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  author: null,
  ...extra,
})

const people = [row("me", ["admin"]), row("o", ["owner"]), row("e", ["editor"])]

function renderAs(actor: MePayload) {
  const onAction = vi.fn()
  render(
    <AdminActorProvider value={actor}>
      <UsersTable users={people as never} onAction={onAction} />
    </AdminActorProvider>
  )
  return onAction
}

const actionsFor = (name: string) =>
  screen.queryByRole("button", { name: `Actions for ${name}` })

describe("UsersTable", () => {
  it("shows role badges and two-factor status", () => {
    renderAs(me("me", ["admin"]))
    const ed = screen
      .getAllByRole("listitem")
      .find((li) => li.textContent?.includes("Person e"))!
    expect(within(ed).getByText("Editor")).toBeTruthy()
    expect(within(ed).getByText("2FA on")).toBeTruthy()
  })

  it("gives an admin no actions on an owner or on themselves", () => {
    renderAs(me("me", ["admin"]))
    expect(actionsFor("Person o")).toBeNull()
    expect(actionsFor("Person me")).toBeNull()
    expect(actionsFor("Person e")).not.toBeNull()
  })

  it("gives an owner actions on another owner", () => {
    renderAs(me("me", ["owner"]))
    expect(actionsFor("Person o")).not.toBeNull()
  })
})

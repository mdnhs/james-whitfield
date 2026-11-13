// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { toMePayload } from "@/lib/auth/me"
import type { RoleName } from "@/lib/auth/permissions"

import { AdminActorProvider } from "@/admin/lib/actor-context"

const pathname = vi.hoisted(() => ({ current: "/admin/settings/contact" }))
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }))

const { SectionTabs } = await import("./section-tabs")

function renderAs(roles: RoleName[], path: string) {
  pathname.current = path
  const actor = toMePayload({
    userId: "u1",
    email: "a@example.com",
    name: "Ann",
    roles,
    twoFactorEnabled: false,
    impersonatedBy: null,
  })
  return render(
    <AdminActorProvider value={actor}>
      <SectionTabs>
        <p>Page</p>
      </SectionTabs>
    </AdminActorProvider>
  )
}

const tabNames = () =>
  within(screen.getByRole("navigation", { name: "Site settings" }))
    .getAllByRole("link")
    .map((link) => link.textContent)

describe("Site settings tabs", () => {
  afterEach(cleanup)

  it("lists every settings page, Appearance and AI assistant for an owner", () => {
    renderAs(["owner"], "/admin/settings/identity")
    expect(tabNames()).toEqual([
      "Identity",
      "Contact & clinic",
      "Forms & microcopy",
      "Notifications",
      "Privacy",
      "Live chat",
      "Appearance",
      "AI assistant",
    ])
  })

  it("shows a globals-only role just the pages it may open", () => {
    renderAs(["editor"], "/admin/settings/contact")
    expect(tabNames()).toEqual(["Contact & clinic", "Forms & microcopy"])
  })

  it("marks the open page and leads each tab with an icon", () => {
    renderAs(["owner"], "/admin/appearance")
    const nav = screen.getByRole("navigation", { name: "Site settings" })
    const current = within(nav).getByRole("link", { current: "page" })
    expect(current.textContent).toBe("Appearance")
    for (const link of within(nav).getAllByRole("link"))
      expect(link.querySelector("svg")).not.toBeNull()
  })

  it("draws no tabs outside a section", () => {
    renderAs(["owner"], "/admin/media")
    expect(screen.queryByRole("navigation")).toBeNull()
    expect(screen.getByText("Page")).toBeTruthy()
  })
})

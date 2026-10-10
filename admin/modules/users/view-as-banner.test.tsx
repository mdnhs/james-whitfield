// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

const stop = vi.fn(async () => ({ data: {}, error: null }))
vi.mock("@/admin/lib/auth-client", () => ({
  authClient: { admin: { stopImpersonating: () => stop() } },
}))

import { ViewAsBanner } from "./view-as-banner"

const me: MePayload = {
  user: { id: "u", email: "ed@example.com", name: "Eddie Editor" },
  roles: ["editor"],
  permissions: {},
  twoFactorEnabled: false,
  impersonatedBy: "owner-id",
}

afterEach(() => vi.unstubAllGlobals())

describe("ViewAsBanner", () => {
  it("says who you are viewing as and stopping reloads the admin", async () => {
    const assign = vi.fn()
    vi.stubGlobal("location", { ...window.location, assign })
    render(
      <AdminActorProvider value={me}>
        <ViewAsBanner />
      </AdminActorProvider>
    )
    expect(screen.getByRole("status").textContent).toContain(
      "Viewing as Eddie Editor (editor)"
    )
    await userEvent.click(screen.getByRole("button", { name: "Stop viewing" }))
    expect(stop).toHaveBeenCalledOnce()
    expect(assign).toHaveBeenCalledWith("/admin/users")
  })

  it("renders nothing for a normal session", () => {
    const { container } = render(
      <AdminActorProvider value={{ ...me, impersonatedBy: null }}>
        <ViewAsBanner />
      </AdminActorProvider>
    )
    expect(container.innerHTML).toBe("")
  })
})

// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/admin/lib/actor-context", () => ({ usePermission: () => true }))
vi.mock("@/admin/lib/api", () => ({
  pagesApi: {},
  parseResponse: (p: Promise<unknown>) => p,
}))

import { AddressForm } from "./address-form"

function setup(page: Parameters<typeof AddressForm>[0]["page"]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AddressForm page={page} onChanged={() => {}} />
    </QueryClientProvider>
  )
}

describe("AddressForm", () => {
  it("shows a service page's address and points to the service for the slug", () => {
    setup({
      id: "p1",
      path: "/services/anxiety-stress",
      systemKey: null,
      serviceId: "s1",
    })
    expect(screen.getByText("/services/anxiety-stress")).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(
      screen
        .getByRole("link", { name: "Website → Services" })
        .getAttribute("href")
    ).toBe("/admin/website/services")
  })

  it("keeps the address field for other custom pages", () => {
    setup({ id: "p2", path: "/team", systemKey: null, serviceId: null })
    expect(screen.getByLabelText("Address")).toBeTruthy()
  })
})

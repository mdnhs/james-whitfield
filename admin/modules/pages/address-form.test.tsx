// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

const patchSlug = vi.fn()
const patchPath = vi.fn()
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/admin/lib/actor-context", () => ({ usePermission: () => true }))
vi.mock("@/admin/lib/api", () => ({
  pagesApi: { ":id": { path: { $patch: (a: unknown) => patchPath(a) } } },
  servicePagesApi: {
    ":serviceId": { slug: { $patch: (a: unknown) => patchSlug(a) } },
  },
  parseResponse: (p: Promise<unknown>) => p,
}))

import { AddressForm } from "./address-form"

function setup(page: Parameters<typeof AddressForm>[0]["page"]) {
  const onChanged = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AddressForm page={page} onChanged={onChanged} />
    </QueryClientProvider>
  )
  return onChanged
}

describe("AddressForm", () => {
  it("edits a service page's slug, not its whole address", async () => {
    patchSlug.mockResolvedValue({ path: "/services/calmer-days" })
    const onChanged = setup({
      id: "p1",
      path: "/services/anxiety-stress",
      systemKey: null,
      serviceId: "s1",
    })
    const slug = screen.getByLabelText("Slug") as HTMLInputElement
    expect(slug.value).toBe("anxiety-stress")
    await userEvent.clear(slug)
    await userEvent.type(slug, "calmer-days")
    await userEvent.click(screen.getByRole("button", { name: "Change slug" }))
    await waitFor(() =>
      expect(patchSlug).toHaveBeenCalledWith({
        param: { serviceId: "s1" },
        json: { slug: "calmer-days" },
      })
    )
    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith("/services/calmer-days")
    )
    expect(patchPath).not.toHaveBeenCalled()
  })

  it("keeps the full address field for other custom pages", () => {
    setup({ id: "p2", path: "/team", systemKey: null, serviceId: null })
    expect(screen.getByLabelText("Address")).toBeTruthy()
    expect(screen.queryByLabelText("Slug")).toBeNull()
  })
})

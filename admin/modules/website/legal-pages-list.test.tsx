// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const publish = vi.fn()
const unpublish = vi.fn()
const del = vi.fn()
const push = vi.fn()
const refresh = vi.fn()
const perms: { allowed: Set<string> | null } = { allowed: null }

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock("@/admin/lib/actor-context", async (orig) => ({
  ...(await orig<typeof import("@/admin/lib/actor-context")>()),
  usePermission: (p: { page?: string[] }) =>
    perms.allowed === null ||
    (p.page ?? []).every((a) => perms.allowed!.has(a)),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
vi.mock("@/admin/lib/api", () => ({
  pagesApi: {
    ":id": {
      publish: { $post: async (a: unknown) => publish(a) },
      unpublish: { $post: async (a: unknown) => unpublish(a) },
      $delete: async (a: unknown) => del(a),
    },
  },
  parseResponse: (p: Promise<unknown>) => p,
}))

const { LegalPagesList } = await import("./legal-pages-list")

const PAGES = [
  {
    id: "p1",
    title: "Privacy Policy",
    path: "/privacy",
    status: "draft" as const,
    version: 3,
  },
  {
    id: "p2",
    title: "Terms",
    path: "/terms",
    status: "published" as const,
    version: 5,
  },
]

function renderList() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <LegalPagesList pages={PAGES} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  perms.allowed = null
  for (const fn of [publish, unpublish, del, push, refresh]) fn.mockReset()
})

describe("Legal pages row actions (like Services)", () => {
  it("the switch publishes a draft and unpublishes a live page with its version", async () => {
    renderList()
    const privacy = screen.getByRole("switch", {
      name: "Publish Privacy Policy",
    })
    expect(privacy.getAttribute("aria-checked")).toBe("false")
    await userEvent.click(privacy)
    await waitFor(() =>
      expect(publish).toHaveBeenCalledWith({
        param: { id: "p1" },
        json: { version: 3 },
      })
    )
    await userEvent.click(screen.getByRole("switch", { name: "Publish Terms" }))
    await waitFor(() =>
      expect(unpublish).toHaveBeenCalledWith({
        param: { id: "p2" },
        json: { version: 5 },
      })
    )
    expect(refresh).toHaveBeenCalled()
  })

  it("Edit opens the page editor; Delete asks first, then deletes", async () => {
    renderList()
    await userEvent.click(screen.getByRole("button", { name: "Edit Terms" }))
    expect(push).toHaveBeenCalledWith("/admin/pages/p2")
    await userEvent.click(screen.getByRole("button", { name: "Delete Terms" }))
    expect(del).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }))
    await waitFor(() =>
      expect(del).toHaveBeenCalledWith({ param: { id: "p2" } })
    )
  })

  it("without publish or delete rights the switch is disabled and Delete is hidden", () => {
    perms.allowed = new Set(["read", "update"])
    renderList()
    const sw = screen.getByRole("switch", { name: "Publish Terms" })
    expect(
      sw.hasAttribute("disabled") || sw.getAttribute("aria-disabled") === "true"
    ).toBe(true)
    expect(screen.queryAllByRole("button", { name: /^Delete / })).toHaveLength(
      0
    )
  })
})

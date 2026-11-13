// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const post = vi.fn()
const ensure = vi.fn()
const del = vi.fn()
const toastError = vi.fn()
const perms: { denied: Set<string> } = { denied: new Set() }
const state: { detailPage: unknown } = { detailPage: null }

vi.mock("@/admin/lib/actor-context", () => ({
  usePermission: (p: Record<string, string[]>) =>
    Object.entries(p).every(([r, acts]) =>
      acts.every((a) => !perms.denied.has(`${r}:${a}`))
    ),
}))
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}))
vi.mock("@/admin/lib/api", () => ({
  servicePagesApi: {
    ensure: { $post: () => ensure() },
    ":serviceId": {
      $post: (a: unknown) => post(a),
      $delete: (a: unknown) => del(a),
    },
  },
  parseResponse: (p: Promise<unknown>) => p,
}))
vi.mock("@/admin/modules/collections/queries", () => ({
  collectionListQuery: (name: string) => ({
    queryKey: ["collections", name, "list"],
    queryFn: async () => ({
      items: [
        {
          id: "s1",
          sort: 0,
          version: 1,
          title: "Websites",
          values: { slug: "websites" },
          usedOn: [],
          detailPage: state.detailPage,
        },
      ],
    }),
  }),
}))

import { ServicePagesView } from "./service-pages-view"

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ServicePagesView />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  perms.denied = new Set()
  state.detailPage = null
  ensure.mockResolvedValue({ created: 0, failed: [] })
})

const draft = {
  id: "p1",
  path: "/services/websites",
  status: "draft",
  updatedAt: "2026-11-13T10:00:00.000Z",
}

describe("ServicePagesView", () => {
  it("makes any missing pages once when it opens", async () => {
    setup()
    await waitFor(() => expect(ensure).toHaveBeenCalledTimes(1))
  })

  it("links each service to its page editor and offers no create or delete", async () => {
    state.detailPage = draft
    setup()
    const links = await screen.findAllByRole("link", { name: "Websites" })
    expect(links[0]!.getAttribute("href")).toBe("/admin/pages/p1")
    expect(screen.getAllByText("Draft").length).toBeGreaterThan(0)
    for (const name of [/create/i, /delete/i, /new service page/i])
      expect(screen.queryByRole("button", { name })).toBeNull()
    expect(post).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it("says why a page could not be made", async () => {
    ensure.mockResolvedValue({
      created: 0,
      failed: [{ serviceId: "s1", message: "Add a call-to-action band first" }],
    })
    setup()
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain("Websites")
    expect(alert.textContent).toContain("Add a call-to-action band first")
    expect(screen.getAllByText("Not created").length).toBeGreaterThan(0)
  })

  it("does not try to make pages without collection:create", async () => {
    perms.denied.add("collection:create")
    setup()
    await screen.findAllByText("Websites")
    expect(ensure).not.toHaveBeenCalled()
  })

  it("puts edit, preview and view on site straight in the row", async () => {
    state.detailPage = { ...draft, status: "published" }
    setup()
    const edit = await screen.findAllByRole("link", { name: "Edit Websites" })
    expect(edit[0]!.getAttribute("href")).toBe("/admin/pages/p1")
    expect(
      screen
        .getAllByRole("link", { name: "Preview Websites" })[0]!
        .getAttribute("href")
    ).toContain("/api/v1/admin/preview?path=%2Fservices%2Fwebsites")
    expect(
      screen
        .getAllByRole("link", { name: "View Websites on the site" })[0]!
        .getAttribute("href")
    ).toBe("/services/websites")
    expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull()
  })

  it("offers no View on site for a draft", async () => {
    state.detailPage = draft
    setup()
    await screen.findAllByRole("link", { name: "Edit Websites" })
    expect(
      screen.queryByRole("link", { name: "View Websites on the site" })
    ).toBeNull()
  })
})

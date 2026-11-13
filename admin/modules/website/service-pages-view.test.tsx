// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/admin/lib/api-error"

const post = vi.fn()
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
const push = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }))
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}))
vi.mock("@/admin/lib/api", () => ({
  servicePagesApi: {
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
})

const published = {
  id: "p1",
  path: "/services/websites",
  status: "published",
  updatedAt: "2026-11-13T10:00:00.000Z",
}

describe("ServicePagesView", () => {
  it("lists a service without a page and creates one, then opens the editor", async () => {
    post.mockResolvedValue({ pageId: "p1", path: "/services/websites" })
    setup()
    expect(await screen.findAllByText("No page yet")).not.toHaveLength(0)
    await userEvent.click(
      screen.getAllByRole("button", { name: "Create page" })[0]!
    )
    expect(post).toHaveBeenCalledWith({ param: { serviceId: "s1" } })
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/pages/p1"))
  })

  it("links the title to the editor and shows the status", async () => {
    state.detailPage = published
    setup()
    const links = await screen.findAllByRole("link", { name: "Websites" })
    expect(links[0]!.getAttribute("href")).toBe("/admin/pages/p1")
    expect(screen.getAllByText("Published").length).toBeGreaterThan(0)
  })

  it("asks before deleting, then calls DELETE once", async () => {
    state.detailPage = published
    del.mockResolvedValue(undefined)
    setup()
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Delete" }))[0]!
    )
    expect(del).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        "Delete the details page for Websites? Its content can't be recovered."
      )
    ).toBeTruthy()
    const confirm = screen.getByRole("button", { name: "Delete page" })
    await userEvent.dblClick(confirm)
    await waitFor(() =>
      expect(del).toHaveBeenCalledWith({ param: { serviceId: "s1" } })
    )
    expect(del).toHaveBeenCalledTimes(1)
  })

  it("hides Create page without collection:create", async () => {
    perms.denied.add("collection:create")
    setup()
    await screen.findAllByText("No page yet")
    expect(screen.queryByRole("button", { name: "Create page" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "New service page" })
    ).toBeNull()
  })

  it("shows the server's message on a 409", async () => {
    post.mockRejectedValue(
      new ApiError(
        "CONFLICT",
        "Add a call-to-action band first",
        409,
        null,
        {},
        {}
      )
    )
    setup()
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Create page" }))[0]!
    )
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Add a call-to-action band first")
    )
    expect(push).not.toHaveBeenCalled()
  })
})

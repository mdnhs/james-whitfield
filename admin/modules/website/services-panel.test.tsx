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
          values: {},
          usedOn: [],
          detailPage: state.detailPage,
        },
      ],
    }),
  }),
}))

import { ServicesPanel } from "./services-panel"

function setup() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ServicesPanel />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  perms.denied = new Set()
  state.detailPage = null
})

describe("ServicesPanel", () => {
  it("turns a details page on and then offers Edit page", async () => {
    post.mockImplementation(async () => {
      state.detailPage = {
        id: "p1",
        path: "/services/websites",
        status: "draft",
      }
      return { pageId: "p1", path: "/services/websites" }
    })
    setup()
    await userEvent.click(
      await screen.findByRole("switch", { name: "Details page for Websites" })
    )
    expect(post).toHaveBeenCalledWith({ param: { serviceId: "s1" } })
    const link = await screen.findByRole("link", { name: "Edit page" })
    expect(link.getAttribute("href")).toBe("/admin/pages/p1")
  })

  it("asks before deleting, then calls DELETE", async () => {
    state.detailPage = {
      id: "p1",
      path: "/services/websites",
      status: "published",
    }
    del.mockResolvedValue(undefined)
    setup()
    await userEvent.click(
      await screen.findByRole("switch", { name: "Details page for Websites" })
    )
    expect(del).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        "Delete the details page for Websites? Its content can't be recovered."
      )
    ).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Delete page" }))
    await waitFor(() =>
      expect(del).toHaveBeenCalledWith({ param: { serviceId: "s1" } })
    )
  })

  it("disables the switch without collection:create", async () => {
    perms.denied.add("collection:create")
    setup()
    const sw = await screen.findByRole("switch", {
      name: "Details page for Websites",
    })
    expect(sw.hasAttribute("data-disabled")).toBe(true)
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
      await screen.findByRole("switch", { name: "Details page for Websites" })
    )
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Add a call-to-action band first")
    )
  })
})

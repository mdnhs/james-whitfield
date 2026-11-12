// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import { ApiError } from "@/admin/lib/api-error"
import type { MePayload } from "@/lib/auth/me"

const del = vi.fn()
const toastError = vi.fn()
const sheet = vi.fn()

vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}))
vi.mock("@/admin/lib/api", () => ({
  collectionsApi: {
    ":name": {
      ":id": { $delete: (a: unknown) => del(a), $patch: vi.fn() },
      order: { $patch: vi.fn() },
    },
  },
  parseResponse: (p: Promise<unknown>) => p,
}))
vi.mock("./queries", () => ({
  collectionListQuery: (name: string) => ({
    queryKey: ["list", name],
    queryFn: async () => ({
      items: [
        {
          id: "a",
          sort: 0,
          version: 1,
          title: "Is it free?",
          values: { isVisible: true },
          usedOn: ["Home", "Contact"],
        },
        {
          id: "b",
          sort: 1,
          version: 1,
          title: "How long?",
          values: { isVisible: true },
          usedOn: ["Home"],
        },
      ],
    }),
  }),
}))
vi.mock("./item-sheet", () => ({
  ItemSheet: (props: { item: unknown }) => {
    sheet(props.item)
    return null
  },
}))

import { ItemsPanel } from "./items-panel"

const actor = (roles: string[]): MePayload =>
  ({
    user: { id: "u", email: "e@x.ie", name: "E" },
    roles,
    permissions: {},
    twoFactorEnabled: false,
    impersonatedBy: null,
  }) as unknown as MePayload

function setup(readOnly: boolean, roles = ["owner"]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminActorProvider value={actor(roles)}>
        <ItemsPanel name="faqs" pageTitle="Home" readOnly={readOnly} />
      </AdminActorProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => vi.clearAllMocks())

describe("ItemsPanel", () => {
  it("lists items and names the other pages that show them", async () => {
    setup(false)
    expect(await screen.findByText("Is it free?")).toBeTruthy()
    expect(screen.getByText("Also shown on: Contact")).toBeTruthy()
    expect(screen.queryByText(/Also shown on: Home/)).toBeNull()
  })

  it("has no Add, Edit or Remove when read-only", async () => {
    setup(true)
    await screen.findByText("Is it free?")
    expect(screen.queryByRole("button", { name: /Add/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull()
  })

  it("opens the sheet for a new item", async () => {
    setup(false)
    await screen.findByText("Is it free?")
    await userEvent.click(screen.getByRole("button", { name: "Add FAQ" }))
    expect(sheet).toHaveBeenLastCalledWith("new")
  })

  it("shows the server's message when a remove is refused", async () => {
    del.mockRejectedValue(
      new ApiError("CONFLICT", "Still used on Home", 409, null, {}, {})
    )
    setup(false)
    await screen.findByText("Is it free?")
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Is it free?" })
    )
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Still used on Home")
    )
  })
})

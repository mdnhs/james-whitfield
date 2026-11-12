// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import { ApiError } from "@/admin/lib/api-error"
import type { MePayload } from "@/lib/auth/me"

const del = vi.fn()
const toastError = vi.fn()
const sheet = vi.fn()
const order = vi.fn()
const dnd: { onDragEnd?: (e: unknown) => void } = {}
const perms: { allowed: Set<string> | null } = { allowed: null }

vi.mock("@/admin/lib/actor-context", async (orig) => ({
  ...(await orig<typeof import("@/admin/lib/actor-context")>()),
  usePermission: (p: { collection?: string[] }) =>
    perms.allowed === null ||
    (p.collection ?? []).every((a) => perms.allowed!.has(a)),
}))
vi.mock("@dnd-kit/core", async (orig) => {
  const actual = await orig<typeof import("@dnd-kit/core")>()
  return {
    ...actual,
    DndContext: (props: { onDragEnd?: (e: unknown) => void } & object) => {
      dnd.onDragEnd = props.onDragEnd
      return (
        <actual.DndContext
          {...(props as React.ComponentProps<typeof actual.DndContext>)}
        />
      )
    },
  }
})
vi.mock("sonner", () => ({
  toast: { error: (m: string) => toastError(m), success: vi.fn() },
}))
vi.mock("@/admin/lib/api", () => ({
  collectionsApi: {
    ":name": {
      ":id": { $delete: (a: unknown) => del(a), $patch: vi.fn() },
      order: { $patch: (a: unknown) => order(a) },
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

beforeEach(() => {
  vi.clearAllMocks()
  perms.allowed = null
})

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
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Still used on Home")
    )
  })

  it("asks first, listing where the item shows; Cancel sends nothing", async () => {
    setup(false)
    await screen.findByText("Is it free?")
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Is it free?" })
    )
    expect(await screen.findByText("Remove Is it free??")).toBeTruthy()
    expect(
      screen.getByText(
        /It is shown on: Home, Contact\. This removes it everywhere\./
      )
    ).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(del).not.toHaveBeenCalled()
  })

  it("deletes on Confirm", async () => {
    del.mockResolvedValue({})
    setup(false)
    await screen.findByText("Is it free?")
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Is it free?" })
    )
    await userEvent.click(screen.getByRole("button", { name: "Remove" }))
    await waitFor(() =>
      expect(del).toHaveBeenCalledWith({ param: { name: "faqs", id: "a" } })
    )
  })

  it("with collection:update only: Edit shown, Add and Remove hidden", async () => {
    perms.allowed = new Set(["update"])
    setup(false)
    await screen.findByText("Is it free?")
    expect(screen.getAllByRole("button", { name: /Edit/ })).toHaveLength(2)
    expect(screen.queryByRole("button", { name: /Add/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull()
  })

  it("keyboard reorder sends the new ids to PATCH /order", async () => {
    order.mockResolvedValue({})
    setup(false)
    await screen.findByText("Is it free?")
    // jsdom has no layout for dnd-kit's sensors: drive its drop handler.
    act(() => dnd.onDragEnd?.({ active: { id: "a" }, over: { id: "b" } }))
    await waitFor(() =>
      expect(order).toHaveBeenCalledWith({
        param: { name: "faqs" },
        json: { ids: ["b", "a"] },
      })
    )
  })
})

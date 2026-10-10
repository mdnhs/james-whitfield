// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

import { RedirectsView } from "./redirects-view"

const row = {
  id: "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
  sourcePath: "/old-about",
  destination: "/about",
  statusCode: 301,
  isActive: true,
  hitCount: 4,
  lastHitAt: null,
  note: "",
  automatic: true,
  shadowed: true,
  updatedAt: "2026-10-01T09:00:00.000Z",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

let postStatus = 201

beforeEach(() => {
  postStatus = 201
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET")
      if (method === "POST") {
        return postStatus === 400
          ? json(
              {
                error: {
                  code: "VALIDATION_FAILED",
                  message: "Check the highlighted fields",
                  fieldErrors: {
                    destination: ["That would create a redirect loop"],
                  },
                },
              },
              400
            )
          : json({ redirect: row, warning: null }, 201)
      }
      return json({ items: [row], page: 1, pageSize: 25, total: 1 })
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderView(roles: MePayload["roles"]) {
  const me: MePayload = {
    user: { id: "u1", email: "mia@example.com", name: "Mia Marketer" },
    roles,
    permissions: {},
    twoFactorEnabled: false,
    impersonatedBy: null,
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <NuqsTestingAdapter>
      <QueryClientProvider client={client}>
        <AdminActorProvider value={me}>
          <RedirectsView />
        </AdminActorProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

it("marks automatic and shadowed rows; a marketer can create", async () => {
  renderView(["marketer"])
  expect((await screen.findAllByText("Automatic")).length).toBeGreaterThan(0)
  expect(
    screen.getAllByText("Inactive while the page is live").length
  ).toBeGreaterThan(0)
  expect(screen.getByRole("button", { name: "New redirect" })).toBeTruthy()
})

it("hides management from a viewer", async () => {
  renderView(["viewer"])
  await screen.findAllByText("Automatic")
  expect(screen.queryByRole("button", { name: "New redirect" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Edit" })).toBeNull()
})

it("shows the server's field error under To", async () => {
  postStatus = 400
  renderView(["marketer"])
  const user = userEvent.setup()
  await user.click(await screen.findByRole("button", { name: "New redirect" }))
  await user.type(await screen.findByLabelText("From"), "/old")
  await user.type(screen.getByLabelText("To"), "/new")
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(
    await screen.findByText("That would create a redirect loop")
  ).toBeTruthy()
})

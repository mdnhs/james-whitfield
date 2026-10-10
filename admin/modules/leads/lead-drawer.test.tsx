// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

import { LeadDrawer } from "./lead-drawer"

const ID = "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc"

const detail = {
  id: ID,
  name: "Ann Example",
  email: "ann@example.com",
  phone: "+353871234567",
  topicSlug: "anxiety",
  formatSlug: null,
  status: "new",
  spamReason: null,
  assignee: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  message: "Hello there",
  planSlug: null,
  privacyConsentAt: "2026-10-01T09:00:00.000Z",
  marketingConsent: false,
  consent: { privacyText: "I agree to the privacy policy" },
  sourcePath: "/contact",
  referrer: "",
  utm: {},
  metaEventId: null,
  activities: [
    {
      id: "a1",
      type: "email",
      body: "",
      data: { kind: "notification", status: "failed", error: "unknown" },
      actor: null,
      createdAt: "2026-10-01T09:00:01.000Z",
    },
    {
      id: "a2",
      type: "note",
      body: "Left a voicemail",
      data: {},
      actor: { id: "u1", name: "Ian Intake" },
      createdAt: "2026-10-01T10:00:00.000Z",
    },
  ],
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

let calls: { url: string; method: string }[] = []

beforeEach(() => {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      const method =
        init?.method ?? (input instanceof Request ? input.method : "GET")
      calls.push({ url, method })
      if (url.endsWith("/assignees")) return json({ items: [] })
      if (url.endsWith("/notes"))
        return json({ ...detail.activities[1], id: "a3" }, 201)
      return json(detail)
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderDrawer(roles: MePayload["roles"]) {
  const me: MePayload = {
    user: { id: "u1", email: "ian@example.com", name: "Ian Intake" },
    roles,
    permissions: {},
    twoFactorEnabled: false,
    impersonatedBy: null,
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <AdminActorProvider value={me}>
        <LeadDrawer id={ID} onClose={() => {}} />
      </AdminActorProvider>
    </QueryClientProvider>
  )
}

it("shows message, consent and timeline; intake cannot erase", async () => {
  renderDrawer(["intake"])
  expect(await screen.findByText("Hello there")).toBeTruthy()
  expect(screen.getByRole("link", { name: "Email" }).getAttribute("href")).toBe(
    "mailto:ann@example.com"
  )
  expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe(
    "tel:+353871234567"
  )
  expect(screen.getByText(/I agree to the privacy policy/)).toBeTruthy()
  expect(screen.getByText("Notification email failed")).toBeTruthy()
  expect(screen.getByText("Left a voicemail")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Erase" })).toBeNull()
})

it("lets an owner erase", async () => {
  renderDrawer(["owner"])
  expect(await screen.findByRole("button", { name: "Erase" })).toBeTruthy()
})

it("posts a note", async () => {
  const user = userEvent.setup()
  renderDrawer(["intake"])
  await user.type(await screen.findByLabelText("Add a note"), "Called back")
  await user.click(screen.getByRole("button", { name: "Add note" }))
  await vi.waitFor(() =>
    expect(calls.find((c) => c.method === "POST")?.url).toMatch(/\/notes$/)
  )
})

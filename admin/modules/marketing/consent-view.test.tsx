// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

import { ConsentView } from "./consent-view"

const COPY = {
  enabled: true,
  title: "Cookies",
  body: "Body",
  accept: "Accept all",
  reject: "Reject all",
  customise: "Customise",
  save: "Save choices",
  settingsLink: "Cookie settings",
  policyLabel: "",
  policyHref: "",
  categories: { necessary: "Needed", analytics: "Counts", marketing: "Ads" },
  reconsentMonths: 6,
  version: 1,
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderView() {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            key: "consent",
            value: COPY,
            version: 2,
            updatedAt: null,
          }),
          { headers: { "Content-Type": "application/json" } }
        )
    )
  )
  const me: MePayload = {
    user: { id: "u1", email: "m@example.com", name: "M" },
    roles: ["marketer"],
    permissions: {},
    twoFactorEnabled: false,
    impersonatedBy: null,
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminActorProvider value={me}>
        <ConsentView />
      </AdminActorProvider>
    </QueryClientProvider>
  )
}

it("updates the preview heading as you type, without saving", async () => {
  renderView()
  const user = userEvent.setup()
  const preview = await screen.findByRole("region", { name: "Preview" })
  const title = await screen.findByLabelText("Title")
  await user.clear(title)
  await user.type(title, "Your privacy")
  expect(
    within(preview).getByRole("heading", { name: "Your privacy" })
  ).toBeTruthy()
  const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
  expect(
    calls.every(([, init]) => !init || (init as RequestInit).method !== "PUT")
  ).toBe(true)
})

it("shows the three category rows on Customise", async () => {
  renderView()
  const user = userEvent.setup()
  const preview = await screen.findByRole("region", { name: "Preview" })
  await screen.findByLabelText("Title")
  await user.click(
    within(preview).getByRole("button", { name: "Customise", pressed: false })
  )
  expect(within(preview).getByText("Necessary")).toBeTruthy()
  expect(within(preview).getByText("Analytics")).toBeTruthy()
  expect(within(preview).getByText("Marketing")).toBeTruthy()
})

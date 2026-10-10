// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

import type { TrackingAdminDoc } from "./queries"
import { TrackingView } from "./tracking-view"

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  test: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock("@/admin/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/admin/lib/api")>()),
  trackingApi: {
    index: { $get: mocks.get, $put: mocks.put },
    "test-capi": { $post: mocks.test },
  },
  parseResponse: async (p: unknown) => await p,
}))
vi.mock("sonner", () => ({ toast: mocks.toast }))

const doc = (over: Partial<TrackingAdminDoc> = {}): TrackingAdminDoc => ({
  version: 3,
  value: {
    gtmId: "GTM-AB12CD3",
    ga4Id: "G-XYZ123",
    metaPixelId: "1234567890",
    testEventCode: "TEST123",
    enabled: { gtm: true, ga4: true, meta: true, capi: true },
    enhancedMatching: {
      enabled: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
    },
  },
  capiToken: { configured: true, readable: true },
  keyAvailable: true,
  status: {
    gtm: "ready",
    ga4: "needs-gtm",
    meta: "needs-banner",
    capi: "no-key",
  },
  lastCapiFailure: null,
  ...over,
})

function renderView(roles: MePayload["roles"], data = doc()) {
  mocks.get.mockResolvedValue(data)
  const me: MePayload = {
    user: { id: "u1", email: "o@example.com", name: "O" },
    roles,
    permissions: {},
    twoFactorEnabled: false,
    impersonatedBy: null,
  }
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AdminActorProvider value={me}>
        <TrackingView />
      </AdminActorProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

it("never shows a stored token, only that one is configured", async () => {
  renderView(["marketer"])
  expect(await screen.findByText("Configured ✓")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Replace token" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Remove token" })).toBeTruthy()
  expect(screen.queryByLabelText("Conversions API access token")).toBeNull()
  for (const input of document.querySelectorAll("input[type=password]"))
    expect((input as HTMLInputElement).value).toBe("")
})

it("lists each channel with its status label", async () => {
  renderView(["marketer"])
  const status = within(await screen.findByRole("region", { name: "Status" }))
  expect(status.getByText("Google Tag Manager")).toBeTruthy()
  expect(status.getByText("Ready")).toBeTruthy()
  expect(status.getByText("GA4")).toBeTruthy()
  expect(status.getByText("Needs GTM")).toBeTruthy()
  expect(status.getByText("Meta Pixel")).toBeTruthy()
  expect(status.getByText("Turn on the consent banner")).toBeTruthy()
  expect(status.getByText("Conversions API")).toBeTruthy()
  expect(
    status.getByText("Server key missing (APP_ENCRYPTION_KEY)")
  ).toBeTruthy()
})

it("explains an unreadable token", async () => {
  const d = doc()
  renderView(["marketer"], {
    ...d,
    status: { ...d.status, capi: "unreadable-token" },
  })
  expect(
    await screen.findByText("Token can't be read; enter it again")
  ).toBeTruthy()
})

it("disables the token field when the server has no key", async () => {
  renderView(["marketer"], {
    ...doc(),
    capiToken: { configured: false, readable: null },
    keyAvailable: false,
  })
  const input = await screen.findByLabelText("Conversions API access token")
  expect((input as HTMLInputElement).disabled).toBe(true)
  expect(screen.getAllByText(/APP_ENCRYPTION_KEY/).length).toBeGreaterThan(0)
})

const ACK =
  "I confirm the practice's DPO or legal adviser approved sending hashed email and phone numbers to Meta"

it("hides enhanced matching from a marketer", async () => {
  renderView(["marketer"])
  await screen.findByText("Configured ✓")
  expect(screen.queryByText("Enhanced matching")).toBeNull()
})

it("keeps the owner's switch off until the acknowledgement is ticked", async () => {
  renderView(["owner"])
  const user = userEvent.setup()
  const sw = await screen.findByRole("switch", {
    name: "Send hashed email and phone numbers with leads",
  })
  expect(
    sw.hasAttribute("disabled") || sw.getAttribute("aria-disabled")
  ).toBeTruthy()
  await user.click(screen.getByRole("checkbox", { name: ACK }))
  await waitFor(() =>
    expect(
      sw.hasAttribute("disabled") || sw.getAttribute("aria-disabled") === "true"
    ).toBe(false)
  )
})

it("sends a test event and toasts the message", async () => {
  mocks.test.mockResolvedValue({
    ok: true,
    status: 200,
    message: "Meta received the test event",
  })
  renderView(["marketer"])
  const user = userEvent.setup()
  await user.click(
    await screen.findByRole("button", { name: "Send test event" })
  )
  await waitFor(() =>
    expect(mocks.toast.success).toHaveBeenCalledWith(
      "Meta received the test event"
    )
  )
  expect(mocks.test).toHaveBeenCalledOnce()
})

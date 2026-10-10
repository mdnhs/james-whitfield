// admin/modules/ai/settings-view.test.tsx
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

import { AiSettingsView } from "./settings-view"

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  models: vi.fn(),
  test: vi.fn(),
}))
vi.mock("@/admin/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/admin/lib/api")>()),
  aiApi: {
    settings: {
      $get: mocks.get,
      $put: mocks.put,
      models: { $post: mocks.models },
      test: { $post: mocks.test },
    },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  )
const doc = (over: Record<string, unknown> = {}) => ({
  version: 3,
  value: {
    enabled: false,
    provider: "google",
    model: "gemini-flash-latest",
    baseUrl: "",
    allowedRoles: ["editor", "author", "marketer", "intake", "viewer"],
    shareEnquiryDetails: {
      enabled: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
    },
    systemPrompt: "",
    maxOutputTokens: 1024,
    ...over,
  },
  apiKey: { hasKey: true, last4: "WXYZ", readable: true },
  keyAvailable: true,
  localHttpAllowed: false,
  mock: false,
})
const owner: MePayload = {
  user: { id: "o", email: "o@x.ie", name: "Olive" },
  roles: ["owner"],
  permissions: { ai: ["use", "manage"] },
  twoFactorEnabled: true,
  impersonatedBy: null,
}
const admin: MePayload = { ...owner, roles: ["admin"] }

function setup(actor = owner) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminActorProvider value={actor}>
        <AiSettingsView />
      </AdminActorProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset()
  mocks.get.mockImplementation(() => json(doc()))
})

describe("AiSettingsView", () => {
  it("never prefills the key and shows only its last 4", async () => {
    setup()
    expect(await screen.findByText(/ending ••••WXYZ/)).toBeTruthy()
    expect(screen.queryByDisplayValue(/WXYZ/)).toBeNull()
  })

  it("warns about Gemini's free tier only for Google", async () => {
    setup()
    expect(await screen.findByText(/Don't paste client details/)).toBeTruthy()
    await userEvent.click(
      screen.getByRole("radio", { name: "Anthropic Claude" })
    )
    expect(screen.queryByText(/Don't paste client details/)).toBeNull()
    expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe(
      "claude-haiku-4-5"
    )
  })

  it("asks for a base URL for OpenAI-compatible providers", async () => {
    setup()
    await userEvent.click(
      await screen.findByRole("radio", { name: "OpenAI-compatible" })
    )
    const url = screen.getByLabelText("Base URL")
    await userEvent.type(url, "http://example.com/v1")
    await userEvent.tab()
    expect(await screen.findByText(/https/)).toBeTruthy()
  })

  it("fills the model picker from List models", async () => {
    mocks.models.mockImplementation(() =>
      json({ ok: true, models: ["gemini-2.5-pro", "gemini-flash-latest"] })
    )
    setup()
    await userEvent.click(
      await screen.findByRole("button", { name: "List models" })
    )
    await waitFor(() =>
      expect(document.querySelectorAll("datalist option")).toHaveLength(2)
    )
  })

  it("lets only an owner share enquiry details, with the acknowledgement", async () => {
    setup(admin)
    expect(
      (
        await screen.findByRole("switch", { name: /enquiry details/ })
      ).hasAttribute("data-disabled")
    ).toBe(true)
  })

  it("warns before a provider change deletes the saved key (Ruling R3)", async () => {
    setup()
    await userEvent.click(
      await screen.findByRole("radio", { name: "Anthropic Claude" })
    )
    expect(screen.getByText(/removes the saved key/)).toBeTruthy()
    await userEvent.type(screen.getByLabelText("API key"), "sk-ant-123456789")
    expect(screen.queryByText(/removes the saved key/)).toBeNull()
  })

  it("makes the enquiry acknowledgement name the 90-day retention (Ruling R15)", async () => {
    setup()
    await userEvent.click(
      await screen.findByRole("switch", { name: /enquiry details/ })
    )
    expect(
      screen.getByRole("checkbox", { name: /kept for up to 90 days/ })
    ).toBeTruthy()
  })

  it("saves the form and disables Test until saved (Ruling R21)", async () => {
    mocks.put.mockImplementation(() => json(doc({ enabled: true })))
    setup()
    const test = await screen.findByRole("button", { name: "Test connection" })
    expect((test as HTMLButtonElement).disabled).toBe(false)
    await userEvent.click(
      screen.getByRole("switch", { name: "Turn on the AI assistant" })
    )
    expect((test as HTMLButtonElement).disabled).toBe(true)
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(mocks.put).toHaveBeenCalled())
    const sent = mocks.put.mock.calls[0]![0].json
    expect(sent).toMatchObject({
      version: 3,
      enabled: true,
      provider: "google",
    })
    expect(sent).not.toHaveProperty("apiKey")
  })
})

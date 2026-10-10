// admin/modules/ai/assistant.test.tsx
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

import { AiAssistant } from "./assistant"

const mocks = vi.hoisted(() => ({ status: vi.fn() }))
vi.mock("@/admin/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/admin/lib/api")>()),
  aiApi: { status: { $get: mocks.status } },
}))
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    status: "ready",
    error: undefined,
    stop: vi.fn(),
    setMessages: vi.fn(),
    clearError: vi.fn(),
    sendMessage: vi.fn(),
  }),
}))

const me: MePayload = {
  user: { id: "u1", email: "e@x.ie", name: "Eddie" },
  roles: ["editor"],
  permissions: { ai: ["use"] },
  twoFactorEnabled: false,
  impersonatedBy: null,
}

beforeEach(() => {
  mocks.status.mockReset()
  mocks.status.mockImplementation(() =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          available: true,
          canManage: false,
          provider: "google",
          model: "gemini-flash-latest",
          freeTierWarning: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    )
  )
})

describe("AiAssistant focus", () => {
  it("focuses the message box on open and returns focus to the topbar button on close", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AdminActorProvider value={me}>
          <AiAssistant />
        </AdminActorProvider>
      </QueryClientProvider>
    )
    const trigger = await screen.findByRole("button", { name: "AI assistant" })
    await userEvent.click(trigger)
    const box = await screen.findByLabelText("Message the AI assistant")
    await waitFor(() => expect(document.activeElement).toBe(box))

    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})

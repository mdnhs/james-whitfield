// admin/modules/ai/assistant-panel.test.tsx
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import { Sheet } from "@/components/ui/sheet"
import type { MePayload } from "@/lib/auth/me"
import type { AiUIMessage } from "@/lib/ai/messages"

import { AssistantPanel, type AssistantPanelProps } from "./assistant-panel"

const me = (over: Partial<MePayload> = {}): MePayload => ({
  user: { id: "u1", email: "e@x.ie", name: "Eddie" },
  roles: ["editor"],
  permissions: {},
  twoFactorEnabled: false,
  impersonatedBy: null,
  ...over,
})
const status = {
  available: true,
  canManage: false,
  provider: "google" as const,
  model: "gemini-flash-latest",
  freeTierWarning: true,
}

function setup(over: Partial<AssistantPanelProps> = {}, actor = me()) {
  const props: AssistantPanelProps = {
    status,
    messages: [],
    chatStatus: "ready",
    error: undefined,
    onSend: vi.fn(),
    onStop: vi.fn(),
    onNewChat: vi.fn(),
    onOpenConversation: vi.fn(),
    activeConversationId: null,
    ...over,
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AdminActorProvider value={actor}>
        {/* SheetTitle needs the Dialog root the real sheet provides. */}
        <Sheet open>
          <AssistantPanel {...props} />
        </Sheet>
      </AdminActorProvider>
    </QueryClientProvider>
  )
  return props
}

describe("AssistantPanel", () => {
  it("offers four starter prompts that fill the composer (Ruling R17)", async () => {
    setup()
    const starters = screen.getAllByRole("button", {
      name: /meta description|warmer|SEO work|enquiries/,
    })
    expect(starters).toHaveLength(4)
    await userEvent.click(
      screen.getByRole("button", { name: "Which pages need SEO work?" })
    )
    expect(
      (screen.getByLabelText("Message the AI assistant") as HTMLTextAreaElement)
        .value
    ).toBe("Which pages need SEO work?")
  })

  it("sends on Enter, keeps Shift+Enter for a new line", async () => {
    const { onSend } = setup()
    const box = screen.getByLabelText("Message the AI assistant")
    await userEvent.type(box, "Line one{Shift>}{Enter}{/Shift}Line two{Enter}")
    expect(onSend).toHaveBeenCalledWith("Line one\nLine two")
  })

  it("renders the log, tool lines, Copy and Stop", async () => {
    const messages: AiUIMessage[] = [
      { id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] },
      {
        id: "2",
        role: "assistant",
        parts: [
          {
            type: "tool-getPage",
            toolCallId: "c",
            state: "output-available",
            input: {},
            output: { label: "About page" },
          } as AiUIMessage["parts"][number],
          { type: "text", text: "**Done**" },
        ],
      },
    ]
    const { onStop } = setup({ messages, chatStatus: "streaming" })
    const log = screen.getByRole("log")
    expect(log.getAttribute("aria-live")).toBe("polite")
    expect(screen.getByText("Looked at: About page")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Stop" }))
    expect(onStop).toHaveBeenCalled()
  })

  it("shows the set-up link to managers when it is off", () => {
    setup(
      { status: { ...status, available: false, canManage: true } },
      me({ roles: ["owner"] })
    )
    expect(
      screen
        .getByRole("link", { name: "Set up AI assistant" })
        .getAttribute("href")
    ).toBe("/admin/settings/ai-assistant")
    expect(screen.queryByLabelText("Message the AI assistant")).toBeNull()
  })

  it("is read-only while viewing as someone (Ruling R12)", () => {
    setup({}, me({ impersonatedBy: "o1" }))
    expect(
      (screen.getByLabelText("Message the AI assistant") as HTMLTextAreaElement)
        .disabled
    ).toBe(true)
    expect(screen.getByText(/while viewing as someone/)).toBeTruthy()
  })

  it("warns about Gemini's free tier", () => {
    setup()
    expect(screen.getByText(/Don't paste client details/)).toBeTruthy()
  })
})

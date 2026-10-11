// admin/modules/ai/assistant-panel.test.tsx
// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import { Sheet } from "@/components/ui/sheet"
import type { MePayload } from "@/lib/auth/me"
import type { AiUIMessage } from "@/lib/ai/messages"

import { COUNTER_FROM, fitTextarea } from "./assistant-composer"
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

  it("greets the person by first name with four starter cards in a grid", () => {
    setup({}, me({ user: { id: "u1", email: "e@x.ie", name: "Eddie Murphy" } }))
    expect(screen.getByText(/, Eddie$/)).toBeTruthy()
    expect(screen.queryByText(/Murphy/)).toBeNull()
    const list = screen.getByRole("list", { name: "Suggestions" })
    expect(list.className).toContain("grid-cols-2")
    const card = screen.getByRole("button", {
      name: "Summarise this week's enquiries",
    })
    expect(card.getAttribute("aria-describedby")).toBeTruthy()
    expect(screen.getByText("Counts by status and topic")).toBeTruthy()
  })

  it("offers page starters in the page editor and article ones in the article editor", async () => {
    setup({ screen: "page" })
    expect(screen.getByText(/the page you're editing/)).toBeTruthy()
    for (const name of [
      "Write a meta description for this page",
      "Suggest a clearer heading",
      "Check this page's SEO",
      "Rewrite the intro warmer",
    ])
      expect(screen.getByRole("button", { name })).toBeTruthy()
    await userEvent.click(
      screen.getByRole("button", { name: "Check this page's SEO" })
    )
    expect(
      (screen.getByLabelText("Message the AI assistant") as HTMLTextAreaElement)
        .value
    ).toBe("Check this page's SEO")
  })

  it("offers enquiry starters on the leads screen", () => {
    setup({ screen: "leads" })
    expect(
      screen.getByRole("button", { name: "Summarise this week's enquiries" })
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: /meta description/ })
    ).toBeNull()
  })

  it("shows what goes with the next message and lets the person leave it out", async () => {
    const onDismissContext = vi.fn()
    setup({ contextLabel: "About page", onDismissContext })
    expect(screen.getByText("About page").parentElement!.textContent).toBe(
      "Using: About page"
    )
    await userEvent.click(
      screen.getByRole("button", {
        name: "Don't use About page for the next message",
      })
    )
    expect(onDismissContext).toHaveBeenCalled()
  })

  it("shows a typing indicator until the first token", () => {
    const user: AiUIMessage = {
      id: "1",
      role: "user",
      parts: [{ type: "text", text: "Hi" }],
    }
    setup({ messages: [user], chatStatus: "submitted" })
    expect(screen.getByText("The assistant is writing")).toBeTruthy()
  })

  const turn: AiUIMessage[] = [
    { id: "u-1", role: "user", parts: [{ type: "text", text: "First" }] },
    { id: "a-1", role: "assistant", parts: [{ type: "text", text: "One" }] },
    { id: "u-2", role: "user", parts: [{ type: "text", text: "Second" }] },
    { id: "a-2", role: "assistant", parts: [{ type: "text", text: "Two" }] },
  ]

  it("regenerates only the last reply of a saved conversation, when idle", async () => {
    const onRegenerate = vi.fn()
    setup({ messages: turn, activeConversationId: "c1", onRegenerate })
    const buttons = screen.getAllByRole("button", { name: "Regenerate" })
    expect(buttons).toHaveLength(1)
    await userEvent.click(buttons[0]!)
    expect(onRegenerate).toHaveBeenCalled()
  })

  it("hides Regenerate and Edit while streaming, before saving, and in View-as", () => {
    const extra = { onRegenerate: vi.fn(), onEdit: vi.fn() }
    setup({
      messages: turn,
      activeConversationId: "c1",
      chatStatus: "streaming",
      ...extra,
    })
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull()
  })

  it("hides Regenerate and Edit without a saved conversation or while viewing as", () => {
    const extra = { onRegenerate: vi.fn(), onEdit: vi.fn() }
    setup({ messages: turn, activeConversationId: null, ...extra })
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull()
    setup(
      { messages: turn, activeConversationId: "c1", ...extra },
      me({ impersonatedBy: "o1" })
    )
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull()
  })

  it("edits the last message of the person and resends it", async () => {
    const onEdit = vi.fn()
    setup({ messages: turn, activeConversationId: "c1", onEdit })
    const edits = screen.getAllByRole("button", { name: "Edit" })
    expect(edits).toHaveLength(1)
    await userEvent.click(edits[0]!)
    const box = screen.getByLabelText(
      "Edit your message"
    ) as HTMLTextAreaElement
    expect(box.value).toBe("Second")
    expect(document.activeElement).toBe(box)
    await userEvent.clear(box)
    await userEvent.type(box, "Second, better{Enter}")
    expect(onEdit).toHaveBeenCalledWith("u-2", "Second, better")
    expect(screen.queryByLabelText("Edit your message")).toBeNull()
  })

  it("says Copied after copying a reply", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
    setup({ messages: turn, activeConversationId: "c1" })
    await userEvent.click(
      screen.getAllByRole("button", { name: "Copy" }).at(-1)!
    )
    expect(writeText).toHaveBeenCalledWith("Two")
    expect(await screen.findByRole("button", { name: "Copied" })).toBeTruthy()
  })

  it("counts characters near the 8 000 limit and keeps Send off while empty", () => {
    setup()
    const box = screen.getByLabelText("Message the AI assistant")
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    fireEvent.change(box, { target: { value: "x".repeat(COUNTER_FROM - 1) } })
    expect(screen.queryByText(/\/ 8,000/)).toBeNull()
    fireEvent.change(box, { target: { value: "x".repeat(7950) } })
    expect(screen.getByText(/7,950 \/ 8,000/)).toBeTruthy()
    expect(box.getAttribute("aria-describedby")).toContain(
      screen.getByText(/7,950 \/ 8,000/).id
    )
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled
    ).toBe(false)
  })

  it("toggles the wider panel", async () => {
    const onToggleExpanded = vi.fn()
    setup({ expanded: false, onToggleExpanded })
    const expand = screen.getByRole("button", { name: "Expand" })
    expect(expand.getAttribute("aria-pressed")).toBe("false")
    await userEvent.click(expand)
    expect(onToggleExpanded).toHaveBeenCalled()
  })
})

describe("fitTextarea", () => {
  const box = (scrollHeight: number) => {
    const el = document.createElement("textarea")
    el.style.lineHeight = "24px"
    el.style.paddingTop = "12px"
    el.style.paddingBottom = "8px"
    Object.defineProperty(el, "scrollHeight", { value: scrollHeight })
    document.body.append(el)
    return el
  }

  it("grows with its text", () => {
    const el = box(68)
    fitTextarea(el)
    expect(el.style.height).toBe("68px")
    expect(el.style.overflowY).toBe("hidden")
  })

  it("stops at eight lines and scrolls inside", () => {
    const el = box(900)
    fitTextarea(el)
    expect(el.style.height).toBe(`${24 * 8 + 20}px`)
    expect(el.style.overflowY).toBe("auto")
  })
})

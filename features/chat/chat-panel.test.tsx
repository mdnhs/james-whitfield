// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { VisitorView } from "@/lib/chat/schema"

import { ChatPanel } from "./chat-panel"
import { useChat } from "./use-chat"

type M = VisitorView["messages"][number]
const msg = (
  id: number,
  sender: M["sender"],
  senderName: string | null = null
): M => ({ id, sender, senderName, body: `body${id}`, createdAt: "x" })
const view = (
  messages: M[],
  extra: Partial<VisitorView> = {}
): VisitorView => ({
  id: "c1",
  status: "open",
  botActive: true,
  needsHuman: false,
  hasEmail: false,
  agentName: null,
  messages,
  lastId: messages.at(-1)?.id ?? 0,
  ...extra,
})

let queue: { status: number; body: unknown }[] = []
let posts: { url: string; body: unknown }[] = []
const STATUS = {
  enabled: true,
  online: true,
  botActive: true,
  welcome: "w",
  offlineNote: "OFFLINE-NOTE",
  botName: "Aoife",
  turnstileSiteKey: null,
}
beforeEach(() => {
  vi.useFakeTimers()
  queue = []
  posts = []
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input)
    if (url.endsWith("/status"))
      return new Response(JSON.stringify(STATUS), { status: 200 })
    if (init?.method === "POST") {
      posts.push({
        url,
        body: init.body ? JSON.parse(String(init.body)) : null,
      })
    }
    const next = queue.shift() ?? { status: 404, body: {} }
    return new Response(JSON.stringify(next.body), { status: next.status })
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const onClose = vi.fn()
function Harness() {
  const chat = useChat(true)
  return (
    <ChatPanel
      chat={chat}
      botName="Aoife"
      welcome="Hello there"
      onClose={onClose}
    />
  )
}
const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe("start form", () => {
  it("blocks submit without consent and shows the field error", async () => {
    queue = [{ status: 404, body: {} }]
    render(<Harness />)
    await flush()
    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: "Sam" },
    })
    fireEvent.change(screen.getByLabelText(/^message/i), {
      target: { value: "Hi" },
    })
    fireEvent.click(screen.getByRole("button", { name: /start chat/i }))
    await flush()
    expect(posts).toHaveLength(0)
    expect(screen.getByText(/please tick the box/i)).toBeTruthy()
  })

  it("posts the chat once consent is ticked", async () => {
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
    ]
    render(<Harness />)
    await flush()
    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: "Sam" },
    })
    fireEvent.change(screen.getByLabelText(/^message/i), {
      target: { value: "Hi" },
    })
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: /start chat/i }))
    await flush()
    expect(posts[0]?.url).toBe("/api/v1/public/chat/start")
    expect(posts[0]?.body).toMatchObject({
      name: "Sam",
      message: "Hi",
      consent: true,
    })
    expect(screen.getByRole("log")).toBeTruthy()
  })
})

describe("thread", () => {
  it("captions AI messages and shows typing until the next reply", async () => {
    queue = [
      { status: 200, body: view([msg(1, "ai"), msg(2, "visitor")]) },
      { status: 200, body: view([msg(3, "ai")]) },
    ]
    render(<Harness />)
    await flush()
    expect(screen.getByText("Aoife · AI")).toBeTruthy()
    expect(screen.getByRole("status").textContent).toContain("Aoife is typing…")
    await tick(3000)
    expect(screen.queryByText(/is typing/)).toBeNull()
  })

  it("hides the typing indicator after 30s", async () => {
    queue = [{ status: 200, body: view([msg(1, "visitor")]) }]
    render(<Harness />)
    await flush()
    expect(screen.getByText(/is typing/)).toBeTruthy()
    for (let i = 0; i < 12; i++)
      queue.push({ status: 200, body: view([], { lastId: 1 }) })
    await tick(30_000)
    expect(screen.queryByText(/is typing/)).toBeNull()
  })

  it("announces staff messages but not the visitor's own", async () => {
    queue = [
      { status: 200, body: view([msg(1, "ai")]) },
      {
        status: 200,
        body: view([msg(2, "visitor"), msg(3, "staff", "Magda")], {
          botActive: false,
          agentName: "Magda",
        }),
      },
    ]
    const { container } = render(<Harness />)
    await flush()
    await tick(3000)
    const live = container.querySelector('[aria-live="polite"]')
    expect(live?.textContent).toContain("body3")
    expect(live?.textContent).not.toContain("body2")
    expect(screen.getByText(/Chatting with Magda/)).toBeTruthy()
  })

  it("shows Start a new chat after a 409", async () => {
    queue = [
      { status: 200, body: view([msg(1, "ai")]) },
      { status: 409, body: { error: { code: "CONFLICT" } } },
    ]
    render(<Harness />)
    await flush()
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "hello" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^send/i }))
    await flush()
    expect(screen.getAllByText("This chat has ended.").length).toBeGreaterThan(
      0
    )
    expect(
      screen.getByRole("button", { name: "Start a new chat" })
    ).toBeTruthy()
    expect(screen.queryByRole("textbox")).toBeNull()
  })
})

describe("dialog", () => {
  it("is a labelled modal that traps Tab and closes on Escape", async () => {
    queue = [{ status: 404, body: {} }]
    render(<Harness />)
    await flush()
    const dialog = screen.getByRole("dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    const labelId = dialog.getAttribute("aria-labelledby")
    expect(document.getElementById(labelId!)?.textContent).toBeTruthy()
    const focusables = [
      ...dialog.querySelectorAll<HTMLElement>(
        "button, input:not([type=hidden]), textarea, a[href]"
      ),
    ].filter((el) => el.tabIndex >= 0 && el.getAttribute("tabindex") !== "-1")
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    expect(document.activeElement).toBe(screen.getByLabelText(/^name/i))
    last.focus()
    fireEvent.keyDown(last, { key: "Tab" })
    expect(document.activeElement).toBe(first)
    first.focus()
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })

  it("moves focus to the composer after start and back to the form after Start a new chat", async () => {
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
      { status: 200, body: view([msg(1, "visitor")], { status: "closed" }) },
    ]
    render(<Harness />)
    await flush()
    fireEvent.change(screen.getByLabelText(/^name/i), {
      target: { value: "Sam" },
    })
    fireEvent.change(screen.getByLabelText(/^message/i), {
      target: { value: "Hi" },
    })
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByRole("button", { name: /start chat/i }))
    await flush()
    expect(document.activeElement).toBe(screen.getByRole("textbox"))
    await tick(3000)
    const again = screen.getByRole("button", { name: "Start a new chat" })
    expect(document.activeElement).toBe(again)
    fireEvent.click(again)
    await flush()
    expect(document.activeElement).toBe(screen.getByLabelText(/^name/i))
  })
})

describe("email ask", () => {
  it("shows when a human is needed and no email is stored, hidden when hasEmail", async () => {
    queue = [{ status: 200, body: view([msg(1, "ai")], { needsHuman: true }) }]
    const first = render(<Harness />)
    await flush()
    expect(screen.getByRole("button", { name: "Save email" })).toBeTruthy()
    first.unmount()
    queue = [
      {
        status: 200,
        body: view([msg(1, "ai")], { needsHuman: true, hasEmail: true }),
      },
    ]
    render(<Harness />)
    await flush()
    expect(screen.queryByRole("button", { name: "Save email" })).toBeNull()
  })
})

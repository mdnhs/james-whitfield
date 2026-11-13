// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { StrictMode, useEffect, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ChatStatus, VisitorView } from "@/lib/chat/schema"

import { ChatPanel, type Preset } from "./chat-panel"
import { stubMedia } from "./test-media"
import { useChat } from "./use-chat"

// Turnstile stand-in: solves at once and shows where it sits.
vi.mock("@/features/contact/components/turnstile", () => ({
  Turnstile: ({ onToken }: { onToken(t: string | null): void }) => {
    useEffect(() => onToken("tok"), [onToken])
    return <div data-testid="turnstile" />
  },
}))

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
let posts: { url: string; body: Record<string, unknown> }[] = []
const STATUS: ChatStatus = {
  enabled: true,
  online: false,
  botActive: true,
  welcome: "w",
  offlineNote: "OFFLINE-NOTE",
  botName: "Aoife",
  turnstileSiteKey: null,
}
beforeEach(() => {
  vi.useFakeTimers()
  stubMedia(true)
  queue = []
  posts = []
  onClose.mockClear()
  onClosed.mockClear()
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input)
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
  vi.unstubAllGlobals()
})

const onClose = vi.fn()
const onClosed = vi.fn()
function Harness({
  status = STATUS,
  preset = null,
  open = true,
}: {
  status?: ChatStatus | null
  preset?: Preset | null
  open?: boolean
}) {
  const chat = useChat(open)
  return (
    <ChatPanel
      chat={chat}
      status={status}
      botName="Aoife"
      welcome="Hello there"
      open={open}
      preset={preset}
      onClose={onClose}
      onClosed={onClosed}
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
const composer = () => screen.getByRole("textbox", { name: "Your message" })
const type = (text: string) =>
  fireEvent.change(composer(), { target: { value: text } })
const sendButton = () => screen.getByRole("button", { name: /^send/i })

describe("no start form", () => {
  it("opens straight to the thread: welcome bubble, consent notice, composer", async () => {
    render(<Harness />)
    await flush()
    expect(screen.getByText("Hello there")).toBeTruthy()
    expect(screen.queryByLabelText(/name/i)).toBeNull()
    expect(screen.queryByLabelText(/email/i)).toBeNull()
    expect(screen.queryByRole("checkbox")).toBeNull()
    expect(
      screen.getByText(/Messages are read by an AI assistant and Magda's team/)
        .textContent
    ).toContain("Please don't share health details here.")
    const policy = screen.getByRole("link", { name: /privacy notice/i })
    expect(policy.getAttribute("href")).toBe("/privacy")
    expect(composer()).toBeTruthy()
  })

  it("the first message starts the chat with consent and no name", async () => {
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
    ]
    render(<Harness />)
    await flush()
    type("Hi there")
    fireEvent.click(sendButton())
    await flush()
    expect(posts).toHaveLength(1)
    expect(posts[0]!.url).toBe("/api/v1/public/chat/start")
    expect(posts[0]!.body).toMatchObject({
      message: "Hi there",
      consent: true,
      sourcePath: "/",
      website: "",
    })
    expect(posts[0]!.body).not.toHaveProperty("name")
    expect(screen.getByText("body1")).toBeTruthy()
    expect((composer() as HTMLTextAreaElement).value).toBe("")
  })

  it("later messages go to /messages", async () => {
    queue = [
      { status: 200, body: view([msg(1, "ai")]) },
      { status: 201, body: { ok: true, id: 2 } },
    ]
    render(<Harness />)
    await flush()
    type("More")
    fireEvent.keyDown(composer(), { key: "Enter" })
    await flush()
    expect(posts[0]!.url).toBe("/api/v1/public/chat/messages")
    expect(posts[0]!.body).toEqual({ body: "More" })
  })

  it("keeps the consent line in the footer once the chat exists", async () => {
    queue = [{ status: 200, body: view([msg(1, "ai")]) }]
    render(<Harness />)
    await flush()
    expect(screen.getByText(/read by an AI assistant/)).toBeTruthy()
  })

  it("renders Turnstile above the composer only before the first message", async () => {
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
    ]
    render(<Harness status={{ ...STATUS, turnstileSiteKey: "site" }} />)
    await flush()
    expect(screen.getByTestId("turnstile")).toBeTruthy()
    type("Hi")
    fireEvent.click(sendButton())
    await flush()
    expect(posts[0]!.body).toMatchObject({ turnstileToken: "tok" })
    expect(screen.queryByTestId("turnstile")).toBeNull()
  })

  it("has no Turnstile without a site key", async () => {
    render(<Harness />)
    await flush()
    expect(screen.queryByTestId("turnstile")).toBeNull()
  })

  it("sends a preset as the first message", async () => {
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
    ]
    render(
      <Harness preset={{ id: 1, text: "How does hypnotherapy work?" }} />
    )
    await flush()
    await flush()
    expect(posts).toHaveLength(1)
    expect(posts[0]!.body).toMatchObject({
      message: "How does hypnotherapy work?",
      consent: true,
    })
  })

  // As on the site: the launcher's lookup has finished before the panel
  // mounts with a preset, so the queued send is ready on the very first
  // effect, and dev React (StrictMode) runs that effect twice.
  it("sends a preset exactly once when the panel mounts ready under StrictMode", async () => {
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
      { status: 201, body: view([msg(1, "visitor")]) },
    ]
    function MountLater() {
      const chat = useChat(true)
      const [shown, setShown] = useState(false)
      return shown ? (
        <ChatPanel
          chat={chat}
          status={STATUS}
          botName="Aoife"
          welcome="Hello there"
          open
          preset={{ id: 1, text: "How long are sessions?" }}
          onClose={onClose}
          onClosed={onClosed}
        />
      ) : (
        <button type="button" onClick={() => setShown(true)}>
          show
        </button>
      )
    }
    render(
      <StrictMode>
        <MountLater />
      </StrictMode>
    )
    await flush()
    await flush()
    fireEvent.click(screen.getByRole("button", { name: "show" }))
    await flush()
    await flush()
    expect(posts).toHaveLength(1)
  })
})

describe("status line", () => {
  it("names the agent who holds the chat", async () => {
    queue = [
      {
        status: 200,
        body: view([msg(1, "staff", "Magda")], {
          agentName: "Magda",
          botActive: false,
        }),
      },
    ]
    render(<Harness />)
    await flush()
    expect(screen.getByText("Chatting with Magda")).toBeTruthy()
  })

  it("names the bot while it is active", async () => {
    queue = [{ status: 200, body: view([msg(1, "ai")]) }]
    render(<Harness />)
    await flush()
    expect(screen.getByText("Aoife (AI) · Magda's team can join")).toBeTruthy()
  })

  it("names the bot before the first message when the bot is on", async () => {
    render(<Harness />)
    await flush()
    expect(screen.getByText("Aoife (AI) · Magda's team can join")).toBeTruthy()
  })

  it("says we're online, or that we'll reply soon", async () => {
    const noBot = { ...STATUS, botActive: false }
    const first = render(<Harness status={{ ...noBot, online: true }} />)
    await flush()
    expect(screen.getByText("We're online")).toBeTruthy()
    first.unmount()
    render(<Harness status={noBot} />)
    await flush()
    expect(screen.getByText("We'll reply as soon as we can")).toBeTruthy()
  })
})

describe("email ask", () => {
  const offlineHumanChat = (extra: Partial<VisitorView> = {}) => [
    { status: 200, body: view([msg(1, "ai")], { botActive: false, ...extra }) },
  ]
  const asks = () => screen.queryByRole("button", { name: "Save email" })

  it("shows when the chat exists, nobody is online and no one answers", async () => {
    queue = offlineHumanChat()
    render(<Harness />)
    await flush()
    expect(asks()).toBeTruthy()
    expect(screen.getByText("OFFLINE-NOTE")).toBeTruthy()
    expect(screen.getByLabelText("OFFLINE-NOTE").className).toContain(
      "text-base"
    )
  })

  it.each([
    ["someone is online", {}, { online: true }],
    ["the bot is active", { botActive: true }, {}],
    ["an agent holds the chat", { agentName: "Magda" }, {}],
    ["the email is already stored", { hasEmail: true }, {}],
    ["the chat has ended", { status: "closed" as const }, {}],
  ])("hides when %s", async (_why, extra, status) => {
    queue = offlineHumanChat(extra)
    render(<Harness status={{ ...STATUS, ...status }} />)
    await flush()
    expect(asks()).toBeNull()
  })

  it("hides before there is a chat", async () => {
    render(<Harness />)
    await flush()
    expect(asks()).toBeNull()
  })
})

describe("thread", () => {
  it("captions AI messages and shows the typing bubble until the next reply", async () => {
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

  it("hides the typing bubble after 30s", async () => {
    queue = [{ status: 200, body: view([msg(1, "visitor")]) }]
    render(<Harness />)
    await flush()
    expect(screen.getByText(/is typing/)).toBeTruthy()
    for (let i = 0; i < 12; i++)
      queue.push({ status: 200, body: view([], { lastId: 1 }) })
    await tick(30_000)
    expect(screen.queryByText(/is typing/)).toBeNull()
  })

  it("renders message text as plain text, never as markup or links", async () => {
    const evil = {
      ...msg(1, "ai"),
      body: '<a href="https://x.example">x</a> https://y.example',
    }
    queue = [{ status: 200, body: view([evil]) }]
    const { container } = render(<Harness />)
    await flush()
    expect(container.querySelector('a[href*="example"]')).toBeNull()
    expect(screen.getByText(/https:\/\/y\.example/)).toBeTruthy()
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
  })

  it("shows Start a new chat after a 409, then the composer again", async () => {
    queue = [
      { status: 200, body: view([msg(1, "ai")]) },
      { status: 409, body: { error: { code: "CONFLICT" } } },
    ]
    render(<Harness />)
    await flush()
    type("hello")
    fireEvent.click(sendButton())
    await flush()
    expect(screen.getAllByText("This chat has ended.").length).toBeGreaterThan(
      0
    )
    const again = screen.getByRole("button", { name: "Start a new chat" })
    expect(document.activeElement).toBe(again)
    expect(screen.queryByRole("textbox")).toBeNull()
    fireEvent.click(again)
    await flush()
    expect(document.activeElement).toBe(composer())
  })
})

describe("dialog", () => {
  it("is a labelled modal that traps Tab and closes on Escape", async () => {
    render(<Harness />)
    await flush()
    const dialog = screen.getByRole("dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    const labelId = dialog.getAttribute("aria-labelledby")
    expect(document.getElementById(labelId!)?.textContent).toBeTruthy()
    const focusables = [
      ...dialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([type=hidden]), textarea, a[href]"
      ),
    ].filter((el) => el.getAttribute("tabindex") !== "-1")
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    last.focus()
    fireEvent.keyDown(last, { key: "Tab" })
    expect(document.activeElement).toBe(first)
    first.focus()
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(dialog, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })

  it("focuses the composer on open, before the cookie lookup lands", () => {
    render(<Harness />)
    expect(document.activeElement).toBe(composer())
  })

  it("is a full-screen sheet on phones, above the sticky bar, with 16px inputs", async () => {
    render(<Harness />)
    await flush()
    const dialog = screen.getByRole("dialog")
    const z = /(?:^|\s)z-(\d+)(?:\s|$)/.exec(dialog.className)
    expect(Number(z?.[1])).toBeGreaterThan(50)
    expect(dialog.className).toContain("h-svh")
    expect(composer().className).toContain("text-base")
  })
})

describe("motion", () => {
  it("with reduced motion the panel is visible at once and closes at once", async () => {
    const { rerender } = render(<Harness />)
    await flush()
    const dialog = screen.getByRole("dialog")
    expect(dialog.style.opacity).toBe("")
    expect(dialog.style.transform).toBe("")
    rerender(<Harness open={false} />)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it("without reduced motion the panel animates in from hidden", async () => {
    stubMedia(false)
    render(<Harness />)
    expect(screen.getByRole("dialog").style.opacity).toBe("0")
  })

  it("closes the panel to assistive tech at once, even while it animates", async () => {
    stubMedia(false)
    const { rerender } = render(<Harness />)
    rerender(<Harness open={false} />)
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.hasAttribute("inert")).toBe(true)
  })

  // Dev React (StrictMode) mounts, unmounts and remounts effects. The
  // unmount cleanup used to kill the timeline but keep it in the ref, so the
  // remount played a dead timeline and the panel stayed at its from-state.
  it("plays the open animation to the end under StrictMode", async () => {
    vi.useRealTimers()
    stubMedia(false)
    render(
      <StrictMode>
        <Harness />
      </StrictMode>
    )
    const dialog = screen.getByRole("dialog")
    await waitFor(() => expect(dialog.style.opacity).toBe("1"), {
      timeout: 2000,
    })
    expect(dialog.style.transform).not.toContain("0.72")
  })
})

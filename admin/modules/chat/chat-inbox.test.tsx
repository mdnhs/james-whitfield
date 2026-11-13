// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import type { MePayload } from "@/lib/auth/me"

import { ChatInbox } from "./chat-inbox"

const A = "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc"
const B = "1c6a4d2f-2e3b-4d9c-8f80-23456789abcd"

const chatRow = (over: Record<string, unknown> = {}) => ({
  id: A,
  status: "open",
  aiEnabled: true,
  needsHuman: false,
  assignedTo: null,
  visitorName: "Ann Example",
  visitorEmail: null,
  consentAt: "2026-10-01T09:00:00.000Z",
  sourcePath: "/",
  aiReplyCount: 1,
  messageCount: 3,
  lastMessageAt: new Date().toISOString(),
  unread: true,
  ...over,
})

type Msg = {
  id: number
  sender: string
  senderName: string | null
  body: string
  createdAt: string
}

let state: {
  list: ReturnType<typeof chatRow>[]
  detail: Record<string, unknown>
  messages: Msg[]
  failReply: boolean
}
let calls: { url: string; method: string }[] = []

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

beforeEach(() => {
  calls = []
  const now = new Date().toISOString()
  state = {
    list: [chatRow(), chatRow({ id: B, visitorName: "Bob", unread: false })],
    detail: chatRow(),
    messages: [
      {
        id: 1,
        sender: "visitor",
        senderName: null,
        body: "Hi <b>there</b> https://x.test",
        createdAt: now,
      },
      {
        id: 2,
        sender: "ai",
        senderName: "Assistant",
        body: "Hello! **How** can I help?",
        createdAt: now,
      },
    ],
    failReply: false,
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req = input instanceof Request ? input : null
      const url = String(req ? req.url : input)
      const method = init?.method ?? req?.method ?? "GET"
      calls.push({ url, method })
      const path = new URL(url, "http://x").pathname
      if (path.endsWith("/messages") && method === "POST") {
        return state.failReply
          ? json(
              { error: { code: "CONFLICT", message: "This chat has ended" } },
              409
            )
          : json(
              {
                id: 9,
                sender: "staff",
                senderName: "Ian",
                body: "ok",
                createdAt: now,
              },
              201
            )
      }
      if (method === "POST") return json({ ok: true, chat: state.detail })
      if (path.endsWith("/unread")) return json({ count: 1 })
      if (path.endsWith("/chat") || path.endsWith("/chat/"))
        return json({ items: state.list, next: null })
      return json({
        chat: state.detail,
        assigneeName: null,
        messages: state.messages,
      })
    })
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, "hidden")
})

function renderInbox(
  roles: MePayload["roles"],
  opts: { c?: string; onUrlUpdate?: (u: URLSearchParams) => void } = {}
) {
  const me: MePayload = {
    user: { id: "u1", email: "ian@example.com", name: "Ian" },
    roles,
    permissions: {},
    twoFactorEnabled: false,
    impersonatedBy: null,
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <NuqsTestingAdapter
      searchParams={opts.c ? `?c=${opts.c}` : ""}
      onUrlUpdate={(e) => opts.onUrlUpdate?.(e.searchParams)}
    >
      <QueryClientProvider client={client}>
        <AdminActorProvider value={me}>
          <ChatInbox />
        </AdminActorProvider>
      </QueryClientProvider>
    </NuqsTestingAdapter>
  )
}

const posted = (suffix: string) =>
  calls.some(
    (c) =>
      c.method === "POST" &&
      new URL(c.url, "http://x").pathname.endsWith(suffix)
  )

it("labels AI messages and renders text as plain text", async () => {
  renderInbox(["intake"], { c: A })
  expect(await screen.findByText(/How\*\* can I help/)).toBeTruthy()
  expect(screen.getAllByText("AI").length).toBeGreaterThan(0)
  expect(screen.getByText(/Hi <b>there<\/b> https:\/\/x.test/)).toBeTruthy()
  expect(document.querySelector("a[href='https://x.test']")).toBeNull()
})

it("shows the Needs a person badge in the list", async () => {
  state.list = [chatRow({ needsHuman: true })]
  renderInbox(["intake"])
  expect(await screen.findByText("Needs a person")).toBeTruthy()
})

it("Take over calls takeover", async () => {
  renderInbox(["intake"], { c: A })
  await userEvent.click(
    await screen.findByRole("button", { name: "Take over" })
  )
  await waitFor(() => expect(posted(`/${A}/takeover`)).toBe(true))
})

it("Hand back to AI calls handback", async () => {
  state.detail = chatRow({ aiEnabled: false, assignedTo: "u1" })
  renderInbox(["intake"], { c: A })
  await userEvent.click(
    await screen.findByRole("button", { name: "Hand back to AI" })
  )
  await waitFor(() => expect(posted(`/${A}/handback`)).toBe(true))
})

it("hides Assign and Delete from intake but shows them to an owner", async () => {
  renderInbox(["intake"], { c: A })
  await screen.findByRole("button", { name: "Take over" })
  expect(screen.queryByRole("button", { name: /Assign|Unassign/ })).toBeNull()
  expect(screen.queryByRole("button", { name: "Delete" })).toBeNull()
  cleanup()
  renderInbox(["owner"], { c: A })
  expect(await screen.findByRole("button", { name: "Delete" })).toBeTruthy()
  expect(screen.getByRole("button", { name: /Assign/ })).toBeTruthy()
})

it("syncs the selected chat to ?c=", async () => {
  const onUrlUpdate = vi.fn()
  renderInbox(["intake"], { onUrlUpdate })
  await userEvent.click(await screen.findByRole("button", { name: /Bob/ }))
  await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled())
  expect(onUrlUpdate.mock.calls.at(-1)![0].get("c")).toBe(B)
})

it("marks read while visible but not while the tab is hidden", async () => {
  renderInbox(["intake"], { c: A })
  await waitFor(() => expect(posted(`/${A}/read`)).toBe(true))
  cleanup()
  calls = []
  Object.defineProperty(document, "hidden", {
    value: true,
    configurable: true,
  })
  renderInbox(["intake"], { c: A })
  await screen.findByText(/How\*\* can I help/)
  expect(posted("/read")).toBe(false)
})

it("keeps the draft and shows an error when a send fails", async () => {
  state.failReply = true
  renderInbox(["intake"], { c: A })
  const box = await screen.findByRole("textbox", { name: "Reply" })
  await userEvent.type(box, "Hello Ann")
  await userEvent.click(screen.getByRole("button", { name: "Send" }))
  expect((await screen.findByRole("alert")).textContent).toContain(
    "This chat has ended"
  )
  expect((box as HTMLTextAreaElement).value).toBe("Hello Ann")
})

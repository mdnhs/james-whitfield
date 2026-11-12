// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { VisitorView } from "@/lib/chat/schema"

import { useChat } from "./use-chat"

const msg = (id: number, sender: "visitor" | "ai" | "staff" = "visitor") => ({
  id,
  sender,
  senderName: null,
  body: `m${id}`,
  createdAt: "2026-11-13T10:00:00Z",
})
const view = (
  ids: number[],
  extra: Partial<VisitorView> = {}
): VisitorView => ({
  id: "c1",
  status: "open",
  botActive: true,
  needsHuman: false,
  hasEmail: false,
  agentName: null,
  messages: ids.map((i) => msg(i)),
  lastId: ids.at(-1) ?? 0,
  ...extra,
})

let hidden = false
let responses: (() => Response)[] = []
let urls: string[] = []
const json = (status: number, body: unknown) => () =>
  new Response(JSON.stringify(body), { status })

beforeEach(() => {
  vi.useFakeTimers()
  hidden = false
  urls = []
  responses = []
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  })
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    urls.push(String(input))
    const next = responses.shift()
    if (!next) throw new TypeError("network")
    return next()
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe("useChat polling", () => {
  it("restores a chat on mount and treats 404 as no chat", async () => {
    responses = [json(404, { error: { code: "NOT_FOUND" } })]
    const { result } = renderHook(() => useChat(true))
    await flush()
    expect(urls).toEqual(["/api/v1/public/chat/conversation"])
    expect(result.current.exists).toBe(false)
    expect(result.current.loaded).toBe(true)
    await tick(10_000)
    expect(urls).toHaveLength(1)
  })

  it("sends after=<lastId> and merges without duplicates", async () => {
    responses = [json(200, view([1, 2])), json(200, view([2, 3]))]
    const { result } = renderHook(() => useChat(true))
    await flush()
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2])
    await tick(3000)
    expect(urls[1]).toBe("/api/v1/public/chat/conversation?after=2")
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it("pauses while hidden and polls at once when visible again", async () => {
    responses = [
      json(200, view([1])),
      json(200, view([1])),
      json(200, view([1])),
    ]
    renderHook(() => useChat(true))
    await flush()
    hidden = true
    await tick(30_000)
    expect(urls).toHaveLength(1)
    hidden = false
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await flush()
    expect(urls).toHaveLength(2)
  })

  it("polls every 20s while closed and every 3s while open", async () => {
    responses = Array.from({ length: 6 }, () => json(200, view([1])))
    const { rerender } = renderHook(({ open }) => useChat(open), {
      initialProps: { open: false },
    })
    await flush()
    await tick(19_000)
    expect(urls).toHaveLength(1)
    await tick(1000)
    expect(urls).toHaveLength(2)
    rerender({ open: true })
    await flush()
    const n = urls.length
    await tick(3000)
    expect(urls.length).toBe(n + 1)
  })

  it("backs off 3s then 6s after failures and flags reconnecting", async () => {
    const { result } = renderHook(() => useChat(true))
    await flush()
    expect(urls).toHaveLength(1)
    expect(result.current.reconnecting).toBe(true)
    await tick(2999)
    expect(urls).toHaveLength(1)
    await tick(1)
    expect(urls).toHaveLength(2)
    await tick(5999)
    expect(urls).toHaveLength(2)
    await tick(1)
    expect(urls).toHaveLength(3)
    responses = [json(200, view([1]))]
    await tick(12_000)
    expect(result.current.reconnecting).toBe(false)
  })

  it("marks unread while closed and clears it when opened", async () => {
    responses = [
      json(200, view([1])),
      json(200, { ...view([]), messages: [msg(2, "ai")], lastId: 2 }),
    ]
    const { result, rerender } = renderHook(({ open }) => useChat(open), {
      initialProps: { open: false },
    })
    await flush()
    expect(result.current.unread).toBe(false)
    await tick(20_000)
    expect(result.current.unread).toBe(true)
    rerender({ open: true })
    await flush()
    expect(result.current.unread).toBe(false)
  })

  it("runs a poll requested while one is in flight right after it", async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    responses = [
      () => {
        throw new Error("unused")
      },
    ]
    responses = []
    let n = 0
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      urls.push(String(input))
      n += 1
      if (n === 1) {
        await gate
        return json(200, view([1]))()
      }
      if (String(input).endsWith("/messages"))
        return json(201, { ok: true, id: 2 })()
      return json(200, view([1, 2]))()
    })
    const { result } = renderHook(() => useChat(true))
    await flush() // first poll is now waiting on the gate
    await act(async () => {
      await result.current.send("hello")
    })
    release()
    await flush()
    expect(urls.filter((u) => u.includes("/conversation"))).toHaveLength(2)
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2])
  })
})

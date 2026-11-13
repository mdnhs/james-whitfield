// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { useEffect, useState, type ComponentType } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { stubMedia } from "./test-media"

// next/dynamic stand-in that loads the real panel.
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: ComponentType<never> }>) =>
    function Dynamic(props: Record<string, unknown>) {
      const [C, setC] = useState<ComponentType<Record<string, unknown>> | null>(
        null
      )
      useEffect(() => {
        void loader().then((m) =>
          setC(() => m.default as ComponentType<Record<string, unknown>>)
        )
      }, [])
      return C ? <C {...props} /> : null
    },
}))

import { ChatLauncher } from "./chat-launcher"

let posts: { url: string; body: Record<string, unknown> }[] = []
beforeEach(() => {
  stubMedia(true)
  sessionStorage.clear()
  posts = []
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input)
    if (init?.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body)) })
      return new Response(
        JSON.stringify({
          id: "c1",
          status: "open",
          botActive: true,
          needsHuman: false,
          hasEmail: false,
          agentName: null,
          messages: [
            {
              id: 1,
              sender: "visitor",
              senderName: "Visitor",
              body: (posts.at(-1)!.body.message as string) ?? "",
              createdAt: "x",
            },
          ],
          lastId: 1,
        }),
        { status: 201 }
      )
    }
    if (url.endsWith("/status"))
      return new Response(
        JSON.stringify({
          enabled: true,
          online: false,
          botActive: true,
          welcome: "Hi",
          offlineNote: "",
          botName: "Aoife",
          turnstileSiteKey: null,
        }),
        { status: 200 }
      )
    return new Response("{}", { status: 404 })
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const settle = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {})
}

describe("chat widget", () => {
  it("a preset click opens the panel and sends that preset as the first message", async () => {
    render(<ChatLauncher botName="Aoife" welcome="Hello there" />)
    await settle()
    fireEvent.click(screen.getByRole("button", { name: "How can we help?" }))
    fireEvent.click(
      screen.getByRole("button", { name: "What can it help with?" })
    )
    await waitFor(() => expect(posts).toHaveLength(1))
    await settle()
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(posts[0]!.url).toBe("/api/v1/public/chat/start")
    expect(posts[0]!.body).toMatchObject({
      message: "What can hypnotherapy help with?",
      consent: true,
    })
    expect(posts[0]!.body).not.toHaveProperty("name")
    expect(screen.getByText("What can hypnotherapy help with?")).toBeTruthy()
  })

  it("Ask something else opens with an empty, focused composer", async () => {
    render(<ChatLauncher botName="Aoife" welcome="Hello there" />)
    await settle()
    fireEvent.click(screen.getByRole("button", { name: "How can we help?" }))
    fireEvent.click(screen.getByRole("button", { name: "Ask something else" }))
    const composer = await screen.findByRole("textbox", {
      name: "Your message",
    })
    await settle()
    expect(document.activeElement).toBe(composer)
    expect((composer as HTMLTextAreaElement).value).toBe("")
    expect(posts).toHaveLength(0)
  })
})

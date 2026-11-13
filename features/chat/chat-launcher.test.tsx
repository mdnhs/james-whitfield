// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useEffect, useState, type ComponentType } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { stubMedia } from "./test-media"

const panelLoaded = vi.hoisted(() => vi.fn())

// next/dynamic stand-in: runs the loader when the component first renders.
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
vi.mock("./chat-panel", () => {
  panelLoaded()
  const Panel = ({
    open,
    preset,
    onClose,
    onClosed,
  }: {
    open: boolean
    preset: { text: string } | null
    onClose(): void
    onClosed(): void
  }) => {
    useEffect(() => {
      if (!open) onClosed()
    }, [open, onClosed])
    return (
      <div role="dialog" aria-label="panel">
        <p data-testid="preset">{preset?.text ?? ""}</p>
        <button onClick={onClose}>close</button>
      </div>
    )
  }
  return { ChatPanel: Panel, default: Panel }
})

import { ChatLauncher } from "./chat-launcher"

let online = false
beforeEach(() => {
  stubMedia(true)
  online = false
  sessionStorage.clear()
  panelLoaded.mockClear()
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/status")
      ? new Response(
          JSON.stringify({
            enabled: true,
            online,
            botActive: true,
            welcome: "Hi",
            offlineNote: "",
            botName: "Aoife",
            turnstileSiteKey: null,
          }),
          { status: 200 }
        )
      : new Response("{}", { status: 404 })
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const settle = () => act(async () => {})
const launcher = () => screen.getByRole("button", { name: /^(open|close) chat/i })
const hint = () => screen.queryByRole("group", { name: "Chat options" })

describe("ChatLauncher", () => {
  it("loads the panel only after a click and returns focus on close", async () => {
    render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    await settle()
    expect(panelLoaded).not.toHaveBeenCalled()
    const button = launcher()
    expect(button.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(button)
    await settle()
    expect(panelLoaded).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(button.getAttribute("aria-expanded")).toBe("true")
    expect(button.getAttribute("aria-label")).toBe("Close chat")
    fireEvent.click(screen.getByText("close"))
    await settle()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it("the launcher toggles the panel closed too", async () => {
    render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    await settle()
    fireEvent.click(launcher())
    await settle()
    fireEvent.click(launcher())
    await settle()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("rides above the sticky CTA bar through its CSS variable", async () => {
    render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    await settle()
    const style = launcher().parentElement!.getAttribute("style")
    expect(style).toContain("var(--sticky-cta-h, 0px)")
    expect(style).toContain("safe-area-inset-bottom")
  })

  it("shows the hint beside the launcher, with the online dot when someone is online", async () => {
    online = true
    render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    await settle()
    expect(hint()).toBeTruthy()
    expect(hint()!.querySelector("[data-online-dot]")).toBeTruthy()
  })

  it("a preset opens the panel and hands it the preset to send", async () => {
    render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    await settle()
    fireEvent.click(screen.getByRole("button", { name: "How can we help?" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Book a free discovery call" })
    )
    await settle()
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByTestId("preset").textContent).toBe(
      "I'd like to book a discovery call."
    )
    expect(hint()).toBeNull()
  })

  it("Ask something else opens the panel with no preset", async () => {
    render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    await settle()
    fireEvent.click(screen.getByRole("button", { name: "How can we help?" }))
    fireEvent.click(screen.getByRole("button", { name: "Ask something else" }))
    await settle()
    expect(screen.getByRole("dialog")).toBeTruthy()
    expect(screen.getByTestId("preset").textContent).toBe("")
  })

  it("the hint's X hides the pill for this page view only; a reload brings the presets back", async () => {
    const first = render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    await settle()
    fireEvent.click(screen.getByRole("button", { name: "Hide this message" }))
    await settle()
    expect(hint()).toBeNull()
    expect(launcher()).toBeTruthy()
    first.unmount()
    render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    await settle()
    expect(hint()).toBeTruthy()
  })

  it("with reduced motion the launcher and hint are fully visible", async () => {
    render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    await settle()
    expect(launcher().style.transform).toBe("")
    expect(hint()!.style.clipPath ?? "").toBe("")
  })
})

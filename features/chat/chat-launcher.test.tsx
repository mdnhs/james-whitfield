// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useEffect, useState, type ComponentType } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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
  const Panel = ({ onClose }: { onClose(): void }) => (
    <div role="dialog" aria-label="panel">
      <button onClick={onClose}>close</button>
    </div>
  )
  return { ChatPanel: Panel, default: Panel }
})

import { ChatLauncher } from "./chat-launcher"

beforeEach(() => {
  panelLoaded.mockClear()
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () => new Response("{}", { status: 404 })
  )
})
afterEach(() => vi.restoreAllMocks())

describe("ChatLauncher", () => {
  it("loads the panel only after a click and returns focus on close", async () => {
    render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    await act(async () => {})
    expect(panelLoaded).not.toHaveBeenCalled()
    const launcher = screen.getByRole("button", { name: /chat/i })
    fireEvent.click(launcher)
    await act(async () => {})
    expect(panelLoaded).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("dialog")).toBeTruthy()
    fireEvent.click(screen.getByText("close"))
    await act(async () => {})
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(launcher)
  })

  it("rides above the sticky CTA bar through its CSS variable", () => {
    render(<ChatLauncher botName="Aoife" welcome="Hi" />)
    const style = screen
      .getByRole("button", { name: /chat/i })
      .getAttribute("style")
    expect(style).toContain("var(--sticky-cta-h, 0px)")
    expect(style).toContain("safe-area-inset-bottom")
  })
})

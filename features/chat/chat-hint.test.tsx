// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChatHint, PRESETS } from "./chat-hint"
import { stubMedia } from "./test-media"

afterEach(() => vi.unstubAllGlobals())

function setup(online = false) {
  const onOpen = vi.fn()
  const onGone = vi.fn()
  const view = render(
    <ChatHint
      online={online}
      skipEntrance={false}
      onEntered={() => {}}
      onOpen={onOpen}
      onGone={onGone}
    />
  )
  return { onOpen, onGone, ...view }
}
const trigger = () => screen.getByRole("button", { name: "How can we help?" })

describe("ChatHint", () => {
  it("shows the title, the subline and the online dot", () => {
    stubMedia(true)
    const { container, unmount } = setup(true)
    expect(trigger().textContent).toContain("How can we help?")
    expect(screen.getByText("Questions about sessions or booking?")).toBeTruthy()
    expect(container.querySelector("[data-online-dot]")).toBeTruthy()
    unmount()
    const offline = setup(false)
    expect(offline.container.querySelector("[data-online-dot]")).toBeNull()
  })

  it("lists the site's presets, ending with Ask something else", () => {
    expect(PRESETS.map((p) => p.label)).toEqual([
      "How does hypnotherapy work?",
      "What can it help with?",
      "Sessions, length & fees",
      "Book a discovery call",
      "Ask something else",
    ])
  })

  it("expands the tray and picking a preset opens with its message", () => {
    stubMedia(true)
    const { onOpen } = setup()
    expect(trigger().getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByRole("button", { name: "What can it help with?" }))
      .toBeNull()
    fireEvent.click(trigger())
    expect(trigger().getAttribute("aria-expanded")).toBe("true")
    fireEvent.click(
      screen.getByRole("button", { name: "Sessions, length & fees" })
    )
    expect(onOpen).toHaveBeenCalledWith(
      "How long are sessions, and what do they cost?"
    )
  })

  it("keyboard focus expands the tray too", () => {
    stubMedia(true)
    setup()
    fireEvent.focus(trigger())
    expect(trigger().getAttribute("aria-expanded")).toBe("true")
  })

  it("Ask something else opens with no message", () => {
    stubMedia(true)
    const { onOpen } = setup()
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole("button", { name: "Ask something else" }))
    expect(onOpen).toHaveBeenCalledWith("")
  })

  it("the X dismisses the pill at once with reduced motion", () => {
    stubMedia(true)
    const { onGone } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Hide this message" }))
    expect(onGone).toHaveBeenCalledTimes(1)
  })

  it("the X closes the pill as a shrinking circle, then reports it gone", async () => {
    stubMedia(false)
    const { onGone } = setup()
    fireEvent.click(screen.getByRole("button", { name: "Hide this message" }))
    expect(onGone).not.toHaveBeenCalled()
    await waitFor(() => expect(onGone).toHaveBeenCalledTimes(1))
  })

  it("with reduced motion the text is never moved out of view", () => {
    stubMedia(false)
    const moving = setup()
    const risen = moving.container.querySelector<HTMLElement>(
      "[data-hint-rise]"
    )
    expect(risen?.style.transform).toContain("translate")
    moving.unmount()
    stubMedia(true)
    const still = setup()
    for (const el of still.container.querySelectorAll<HTMLElement>(
      "[data-hint-rise]"
    )) {
      expect(el.style.transform).toBe("")
      expect(el.style.opacity).toBe("")
    }
  })
})

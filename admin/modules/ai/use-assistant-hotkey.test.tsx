// admin/modules/ai/use-assistant-hotkey.test.tsx
// @vitest-environment jsdom
import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { isAssistantShortcut, useAssistantHotkey } from "./use-assistant-hotkey"

const key = (init: KeyboardEventInit) =>
  new KeyboardEvent("keydown", { key: "j", cancelable: true, ...init })

describe("⌘J / Ctrl+J (Ruling R18)", () => {
  it("needs exactly one modifier", () => {
    expect(isAssistantShortcut(key({ metaKey: true }))).toBe(true)
    expect(isAssistantShortcut(key({ ctrlKey: true }))).toBe(true)
    expect(isAssistantShortcut(key({}))).toBe(false)
    expect(isAssistantShortcut(key({ metaKey: true, shiftKey: true }))).toBe(
      false
    )
    expect(isAssistantShortcut(key({ key: "k", metaKey: true }))).toBe(false)
  })

  it("fires once per press, only while enabled, and claims the key", () => {
    const fn = vi.fn()
    const { rerender } = renderHook(({ on }) => useAssistantHotkey(on, fn), {
      initialProps: { on: true },
    })
    const e = key({ ctrlKey: true })
    window.dispatchEvent(e)
    window.dispatchEvent(key({ ctrlKey: true, repeat: true }))
    expect(fn).toHaveBeenCalledTimes(1)
    expect(e.defaultPrevented).toBe(true)
    rerender({ on: false })
    window.dispatchEvent(key({ ctrlKey: true }))
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

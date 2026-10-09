// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { isPaletteShortcut, useCommandHotkey } from "./use-command-hotkey"

function Probe({ onTrigger }: { onTrigger: () => void }) {
  useCommandHotkey(onTrigger)
  return (
    <>
      <input aria-label="Field" />
      <div
        data-testid="editor"
        contentEditable
        suppressContentEditableWarning
        tabIndex={0}
      />
    </>
  )
}

describe("useCommandHotkey", () => {
  it("opens on ⌘K and Ctrl+K", async () => {
    const onTrigger = vi.fn()
    render(<Probe onTrigger={onTrigger} />)
    await userEvent.keyboard("{Meta>}k{/Meta}")
    await userEvent.keyboard("{Control>}k{/Control}")
    expect(onTrigger).toHaveBeenCalledTimes(2)
  })

  // Review Focus #3 and the "no single-key hotkeys" rule.
  it("ignores a bare k or d, including while typing in a field", async () => {
    const onTrigger = vi.fn()
    render(<Probe onTrigger={onTrigger} />)
    await userEvent.keyboard("kd")
    await userEvent.type(screen.getByLabelText("Field"), "kdkd")
    expect(onTrigger).not.toHaveBeenCalled()
  })

  it("opens from plain fields but leaves rich-text editors and handled events alone", async () => {
    const onTrigger = vi.fn()
    render(<Probe onTrigger={onTrigger} />)
    await userEvent.click(screen.getByLabelText("Field"))
    await userEvent.keyboard("{Meta>}k{/Meta}")
    expect(onTrigger).toHaveBeenCalledTimes(1)

    const editor = screen.getByTestId("editor")
    editor.focus()
    await userEvent.keyboard("{Meta>}k{/Meta}")
    expect(onTrigger).toHaveBeenCalledTimes(1)

    const handled = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      cancelable: true,
      bubbles: true,
    })
    handled.preventDefault()
    window.dispatchEvent(handled)
    expect(onTrigger).toHaveBeenCalledTimes(1)
  })

  it("leaves ⌘⇧K and ⌥⌘K to the browser", () => {
    const base = { key: "k", metaKey: true, ctrlKey: false }
    expect(isPaletteShortcut({ ...base, shiftKey: true, altKey: false })).toBe(
      false
    )
    expect(isPaletteShortcut({ ...base, shiftKey: false, altKey: true })).toBe(
      false
    )
    expect(isPaletteShortcut({ ...base, shiftKey: false, altKey: false })).toBe(
      true
    )
  })
})

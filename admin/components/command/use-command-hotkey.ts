"use client"

import { useEffect } from "react"

type KeyLike = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>

// ⌘K on macOS, Ctrl+K elsewhere. A modifier is required, so typing in a
// field never opens the palette (no single-key hotkeys).
export function isPaletteShortcut(event: KeyLike) {
  return (
    event.key.toLowerCase() === "k" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

// Fields and rich-text editors own their keystrokes (same guard as the
// sidebar's ⌘B), except the palette's own input, which toggles it closed.
function ownsKeystroke(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.closest('[data-slot="command"]')) return false
  return (
    target.isContentEditable ||
    target.closest('[contenteditable]:not([contenteditable="false"])') !==
      null ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

export function useCommandHotkey(onTrigger: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.defaultPrevented) return
      if (!isPaletteShortcut(event) || ownsKeystroke(event.target)) return
      event.preventDefault()
      onTrigger()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onTrigger])
}

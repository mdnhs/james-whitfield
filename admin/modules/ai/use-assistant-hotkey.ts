// admin/modules/ai/use-assistant-hotkey.ts
"use client"

import { useEffect } from "react"

type KeyLike = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>

// ⌘J / Ctrl+J. Unlike ⌘K it also works inside the rich-text editor: TipTap
// binds no Mod-j, and that is where people most want help (Ruling R18).
export function isAssistantShortcut(event: KeyLike) {
  return (
    event.key.toLowerCase() === "j" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  )
}

export function useAssistantHotkey(enabled: boolean, onTrigger: () => void) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.defaultPrevented || !isAssistantShortcut(event))
        return
      event.preventDefault()
      onTrigger()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [enabled, onTrigger])
}

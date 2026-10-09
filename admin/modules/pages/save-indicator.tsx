"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

import type { AutosaveState } from "./use-autosave"

const DOT: Record<AutosaveState["status"], string> = {
  idle: "bg-muted-foreground/40",
  pending: "bg-warning",
  saving: "bg-primary animate-pulse",
  saved: "bg-success",
  error: "bg-danger",
  conflict: "bg-danger",
}

function label(state: AutosaveState, now: number) {
  switch (state.status) {
    case "idle":
      return "No changes yet"
    case "pending":
      return "Unsaved changes"
    case "saving":
      return "Saving…"
    case "saved": {
      const seconds = Math.max(
        0,
        Math.round((now - (state.savedAt ?? now)) / 1000)
      )
      return `Saved ${seconds} s ago`
    }
    case "error":
      return `Couldn't save: ${state.error}`
    case "conflict":
      return "Changed by someone else"
  }
}

export function SaveIndicator({ state }: { state: AutosaveState }) {
  const [now, setNow] = useState(() => Date.now())
  // A save newer than `now` reads as 0 s until the next tick.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])
  return (
    <p
      aria-live="polite"
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-2 rounded-full bg-card px-3.5 text-[13px] font-medium text-muted-foreground",
        (state.status === "error" || state.status === "conflict") &&
          "text-danger"
      )}
    >
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", DOT[state.status])}
      />
      <span className="truncate">{label(state, now)}</span>
    </p>
  )
}

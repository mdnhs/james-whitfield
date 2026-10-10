"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { ApiError } from "@/admin/lib/api-error"
import { handleSessionError } from "@/admin/lib/query-client"
import { isSigningOut, registerSignOutFlush } from "@/admin/lib/sign-out-guard"

export type Conflict = {
  version: number
  updatedAt: string | null
  updatedBy: string | null
}
export type SaveStatus =
  "idle" | "pending" | "saving" | "saved" | "error" | "conflict"
export type AutosaveState = {
  status: SaveStatus
  savedAt: number | null
  error: string | null
  conflict: Conflict | null
}
export type SaveOptions = { keepalive?: boolean }

export function conflictOf(error: unknown): Conflict | null {
  if (!(error instanceof ApiError) || error.code !== "CONFLICT") return null
  const current = (error.details as { current?: Conflict } | null)?.current
  return current && typeof current.version === "number" ? current : null
}

const sessionEnded = (error: unknown) =>
  error instanceof ApiError && error.code === "UNAUTHENTICATED"

const IDLE: AutosaveState = {
  status: "idle",
  savedAt: null,
  error: null,
  conflict: null,
}
// A failed save (offline, 5xx) is retried on its own, not only on the next
// keystroke, so a pause after the last edit does not strand it.
const RETRY_MS = 5000

// A 4xx (403 after a role change, 413, 422) will not fix itself: it stays
// on screen until the next edit instead of retrying forever.
const transient = (error: unknown) =>
  !(error instanceof ApiError) ||
  error.status === 0 ||
  error.status === 408 ||
  error.status === 429 ||
  error.status >= 500

// Thrown by exclusive() when the queue could not be emptied first.
export class UnsavedChangesError extends Error {
  constructor() {
    super("Your latest changes are not saved yet")
    this.name = "UnsavedChangesError"
  }
}

// docs/brief.md §6.5: ~1.2 s debounce, one request at a time, the newest
// value wins, and after a 409 nothing is sent until the editor chooses
// Overwrite (resend on their version) or Review (reset to the server copy).
// Pending edits are flushed when the route hides (<Activity>), the tab is
// backgrounded or closed, and before sign-out; never after it.
export function useAutosave<T>({
  version: initialVersion,
  save,
  delay = 1200,
}: {
  version: number
  save: (
    value: T,
    version: number,
    options?: SaveOptions
  ) => Promise<{ version: number }>
  delay?: number
}) {
  const [state, setState] = useState<AutosaveState>(IDLE)
  const version = useRef(initialVersion)
  const pending = useRef<{ value: T } | null>(null)
  // The newest value ever scheduled: Overwrite re-sends it even when the
  // conflict came from somewhere other than a save.
  const latest = useRef<{ value: T } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const running = useRef<Promise<void> | null>(null)
  const conflict = useRef<Conflict | null>(null)
  // The session is over: nothing more is sent from this builder.
  const stopped = useRef(false)
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const blocked = () =>
    conflict.current !== null || stopped.current || isSigningOut()

  const run = useCallback(async (): Promise<void> => {
    while (running.current) await running.current
    const next = pending.current
    if (!next || blocked()) return
    pending.current = null
    setState((s) => ({ ...s, status: "saving", error: null }))
    const attempt = (async () => {
      try {
        const result = await saveRef.current(next.value, version.current)
        version.current = result.version
        setState({
          status: pending.current ? "pending" : "saved",
          savedAt: Date.now(),
          error: null,
          conflict: null,
        })
      } catch (error) {
        // Keep the unsaved edit unless a newer one already replaced it.
        pending.current ??= next
        conflict.current = conflictOf(error)
        if (sessionEnded(error)) {
          stopped.current = true
          handleSessionError(error)
        }
        setState((s) => ({
          ...s,
          status: conflict.current ? "conflict" : "error",
          conflict: conflict.current,
          error: error instanceof Error ? error.message : "Couldn't save",
        }))
        if (
          !conflict.current &&
          !stopped.current &&
          !timer.current &&
          transient(error)
        ) {
          timer.current = setTimeout(() => {
            timer.current = null
            void run()
          }, RETRY_MS)
        }
      }
    })()
    running.current = attempt
    await attempt
    running.current = null
  }, [])

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value }
      latest.current = pending.current
      if (blocked()) return
      setState((s) => ({ ...s, status: "pending" }))
      clearTimer()
      timer.current = setTimeout(() => {
        timer.current = null
        void run()
      }, delay)
    },
    [clearTimer, delay, run]
  )

  // For Publish and ⌘S: true when nothing is left unsaved.
  const flush = useCallback(async () => {
    clearTimer()
    await run()
    return pending.current === null && conflict.current === null
  }, [clearTimer, run])

  const overwrite = useCallback(async () => {
    if (!conflict.current) return
    version.current = conflict.current.version
    conflict.current = null
    pending.current ??= latest.current
    if (!pending.current) setState(IDLE)
    await run()
  }, [run])

  // Publish, discard and restore carry the version too, so they take the
  // queue's place: everything queued is saved first, saves wait while the
  // request runs, and its new version is the one the next save uses.
  const exclusive = useCallback(
    async <R>(request: (version: number) => Promise<R>): Promise<R> => {
      clearTimer()
      await run()
      if (pending.current !== null || blocked()) throw new UnsavedChangesError()
      let release = () => {}
      running.current = new Promise<void>((resolve) => {
        release = resolve
      })
      try {
        const result = await request(version.current)
        const next = (result as { version?: unknown } | null)?.version
        if (typeof next === "number") version.current = next
        return result
      } finally {
        running.current = null
        release()
        // Edits made meanwhile were queued; send them now.
        if (pending.current && !blocked() && !timer.current) void run()
      }
    },
    [clearTimer, run]
  )

  const reset = useCallback(
    (nextVersion: number) => {
      clearTimer()
      pending.current = null
      conflict.current = null
      version.current = nextVersion
      setState(IDLE)
    },
    [clearTimer]
  )

  const markConflict = useCallback((current: Conflict) => {
    conflict.current = current
    setState((s) => ({ ...s, status: "conflict", conflict: current }))
  }, [])

  const setVersion = useCallback((next: number) => {
    version.current = next
  }, [])
  const getVersion = useCallback(() => version.current, [])

  // Route hidden by <Activity> (effect cleanup) or unmounted: save now
  // rather than drop the debounced edit. Sign-out flushes first too.
  useEffect(() => {
    const unregister = registerSignOutFlush(flush)
    return () => {
      unregister()
      void flush()
    }
  }, [flush])

  // Tab backgrounded: save now (mobile browsers may never come back).
  // Tab closing: a last keepalive request, which can outlive the page.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush()
    }
    // Skipped while a request runs: its version is about to change, so
    // this one would only 409.
    const onPageHide = () => {
      const next = pending.current
      if (!next || blocked() || running.current) return
      clearTimer()
      saveRef
        .current(next.value, version.current, { keepalive: true })
        .catch(() => undefined)
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", onPageHide)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [clearTimer, flush])

  // Unsaved-changes guard (docs/brief.md §9.4).
  const unsafe = state.status !== "idle" && state.status !== "saved"
  useEffect(() => {
    if (!unsafe) return
    const guard = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [unsafe])

  return {
    state,
    schedule,
    flush,
    exclusive,
    overwrite,
    reset,
    markConflict,
    setVersion,
    getVersion,
  }
}

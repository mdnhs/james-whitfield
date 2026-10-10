"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"

import { ADMIN_THEME_STORAGE_KEY } from "@/components/theme-provider"

export const AUTO_MARKER_KEY = "mk-admin-theme-auto"

// The ThemeProvider (and its inline script) lives outside Suspense so the
// class is set before first paint; it therefore cannot know the published
// default mode. This applies it on load. The marker records the mode this
// component applied: a stored theme that is absent or equals the marker was
// never chosen by the user, so it follows the current published default. A
// stored theme that differs from the marker is a user choice and is left alone.
export function DefaultMode({ mode }: { mode: string }) {
  const { setTheme } = useTheme()
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ADMIN_THEME_STORAGE_KEY)
      const marker = localStorage.getItem(AUTO_MARKER_KEY)
      if (stored !== null && stored !== marker) {
        localStorage.removeItem(AUTO_MARKER_KEY)
        return
      }
      setTheme(mode)
      localStorage.setItem(AUTO_MARKER_KEY, mode)
    } catch {
      // storage blocked: the system preference stands
    }
  }, [mode, setTheme])
  return null
}

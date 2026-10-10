"use client"

import { useTheme } from "next-themes"
import { useEffect } from "react"

import { ADMIN_THEME_STORAGE_KEY } from "@/components/theme-provider"

// The ThemeProvider (and its inline script) lives outside Suspense so the
// class is set before first paint; it therefore cannot know the published
// default mode. This applies it once, to visitors with no stored choice.
export function DefaultMode({ mode }: { mode: string }) {
  const { setTheme } = useTheme()
  useEffect(() => {
    if (mode === "system") return
    try {
      if (localStorage.getItem(ADMIN_THEME_STORAGE_KEY) === null) setTheme(mode)
    } catch {
      // storage blocked: the system preference stands
    }
  }, [mode, setTheme])
  return null
}

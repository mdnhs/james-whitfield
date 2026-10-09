"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import type * as React from "react"

// The admin's own key, so a theme chosen here can never leak into anything
// else on this origin (the public site is light-only and has no provider).
export const ADMIN_THEME_STORAGE_KEY = "mk-admin-theme"

// Light, dark or system (docs/brief.md §9.4). There is deliberately no
// single-key hotkey: the theme changes from the user menu or ⌘K.
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey={ADMIN_THEME_STORAGE_KEY}
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

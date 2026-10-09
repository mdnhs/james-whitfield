"use client"

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react"

import { useCommandHotkey } from "./use-command-hotkey"

type PaletteState = { open: boolean; setOpen: (open: boolean) => void }

const PaletteContext = createContext<PaletteState | null>(null)

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((value) => !value), [])
  useCommandHotkey(toggle)
  // Tells tests (and nothing else) the ⌘K listener is attached.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.paletteReady = ""
    return () => {
      delete root.dataset.paletteReady
    }
  }, [])
  const value = useMemo(() => ({ open, setOpen }), [open])
  return <PaletteContext value={value}>{children}</PaletteContext>
}

export function useCommandPalette(): PaletteState {
  const state = use(PaletteContext)
  if (!state) {
    throw new Error(
      "useCommandPalette must be used inside CommandPaletteProvider"
    )
  }
  return state
}

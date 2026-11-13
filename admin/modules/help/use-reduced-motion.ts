"use client"

import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {}
  const query = window.matchMedia(QUERY)
  query.addEventListener?.("change", onChange)
  return () => query.removeEventListener?.("change", onChange)
}

const read = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia &&
  window.matchMedia(QUERY).matches

// Whether the viewer asked for less motion. The server renders with motion;
// the client corrects it on hydration.
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, read, () => false)
}

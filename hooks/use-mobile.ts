import * as React from "react"

// The admin's sidebar becomes a sheet below 1024px (docs/brief.md §9.4); the
// sidebar component's own `lg:` classes use the same breakpoint.
const MOBILE_BREAKPOINT = 1024
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

const getSnapshot = () => window.matchMedia(QUERY).matches

// The server renders the desktop markup; below lg it is CSS-hidden until
// hydration swaps in the sheet.
const getServerSnapshot = () => false

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

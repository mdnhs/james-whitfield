"use client"

import { useEffect, useRef } from "react"

// Cache Components keeps a visited route mounted but hidden (<Activity>),
// state included, and runs effect cleanups when it hides. A control that
// stays pending on success (the next screen replaces it) would come back
// disabled on the next visit, so it resets here.
export function useResetOnHide(reset: () => void) {
  const latest = useRef(reset)
  useEffect(() => {
    latest.current = reset
  })
  useEffect(() => () => latest.current(), [])
}

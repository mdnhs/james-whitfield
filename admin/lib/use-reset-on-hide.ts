"use client"

import { useCallback, useEffect, useRef } from "react"

// Cache Components keeps a visited route mounted but hidden (<Activity>),
// state included, and runs effect cleanups when it hides. A control that
// stays pending on success (the next screen replaces it) would come back
// disabled on the next visit, so it resets here.
//
// Returns `begin()`: call it when a request starts, and check the returned
// `current()` after each await. A request that resolves after the route was
// hidden must not write its result (secrets, codes) back into hidden state.
export function useResetOnHide(reset: () => void) {
  const latest = useRef(reset)
  const generation = useRef(0)
  useEffect(() => {
    latest.current = reset
  })
  useEffect(
    () => () => {
      generation.current += 1
      latest.current()
    },
    []
  )
  return useCallback(() => {
    const started = generation.current
    return () => generation.current === started
  }, [])
}

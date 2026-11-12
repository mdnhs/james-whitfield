"use client"

import { useSyncExternalStore } from "react"

// False during SSR; follows the media query on the client.
export function useMedia(media: string) {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(media)
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => matchMedia(media).matches,
    () => false
  )
}

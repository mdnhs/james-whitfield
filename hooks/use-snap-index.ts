"use client"

import { useCallback, useRef, useState } from "react"

// Index of the snap-scrolled slide nearest the track's start edge (the last
// slide once the track is scrolled to its end). Wire `onScroll` to the track.
export function useSnapIndex<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [active, setActive] = useState(0)

  const onScroll = useCallback(() => {
    const el = ref.current
    const first = el?.firstElementChild as HTMLElement | null
    if (!el || !first) return
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 2) {
      setActive(el.childElementCount - 1)
      return
    }
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    setActive(Math.round(el.scrollLeft / (first.offsetWidth + gap)))
  }, [])

  return { ref, active, onScroll }
}

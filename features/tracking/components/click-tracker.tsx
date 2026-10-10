"use client"

import { useEffect } from "react"

import { clickEvent } from "@/lib/tracking/clicks"
import { track } from "@/lib/tracking/track"

export function ClickTracker() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const e = clickEvent(
        event.target instanceof Element ? event.target : null
      )
      if (e) track(e)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])
  return null
}

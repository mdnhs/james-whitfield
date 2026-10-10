"use client"

import { useEffect } from "react"

import { captureAttribution } from "@/features/contact/lib/capture-attribution"

// Remembers the first landing (referrer, UTM) for the enquiry form. Renders nothing.
export function AttributionCapture() {
  useEffect(() => {
    try {
      captureAttribution(
        window.location,
        document.referrer,
        window.sessionStorage
      )
    } catch {}
  }, [])
  return null
}

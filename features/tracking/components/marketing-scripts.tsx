"use client"

import { usePathname } from "next/navigation"
import { useEffect, useSyncExternalStore } from "react"

import {
  getConsentSnapshot,
  getServerConsentSnapshot,
  subscribeConsent,
} from "@/lib/tracking/consent-client"
import { loadPixel } from "@/lib/tracking/pixel"
import { pixelAllowed } from "@/lib/tracking/sanitize"
import { flushMetaPageView } from "@/lib/tracking/track"

// Loads the Meta Pixel only after marketing consent, and only once the visitor
// is on a neutral URL (allowlisted route, no query or hash, neutral referrer; Rulings R7, R8).
// Lazy: a later navigation to an allowed route loads it.
export function MarketingScripts({ pixelId }: { pixelId: string | null }) {
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getServerConsentSnapshot
  )
  const marketing = consent?.marketing === true
  const pathname = usePathname()
  useEffect(() => {
    if (
      !pixelId ||
      !marketing ||
      !pixelAllowed(window.location, document.referrer)
    )
      return
    loadPixel(pixelId)
    // Also covers re-consent with the Pixel already loaded.
    flushMetaPageView()
  }, [pixelId, marketing, pathname])
  return null
}

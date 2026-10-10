"use client"

import { useEffect, useSyncExternalStore } from "react"

import {
  getConsentSnapshot,
  getServerConsentSnapshot,
  subscribeConsent,
} from "@/lib/tracking/consent-client"
import { loadPixel } from "@/lib/tracking/pixel"
import { flushMetaPageView } from "@/lib/tracking/track"

// Loads the Meta Pixel only after marketing consent (Ruling R7).
export function MarketingScripts({ pixelId }: { pixelId: string | null }) {
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getServerConsentSnapshot
  )
  const marketing = consent?.marketing === true
  useEffect(() => {
    if (pixelId && marketing && loadPixel(pixelId)) flushMetaPageView()
  }, [pixelId, marketing])
  return null
}

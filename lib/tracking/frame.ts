import type { GlobalValue, ScriptSnippet } from "@/lib/content/globals"

import type { ConsentPolicy } from "./consent"

export type PublicTracking = {
  gtmId: string | null
  ga4Id: string | null
  pixelId: string | null
}

export type TrackingFrame = {
  active: boolean
  policy: ConsentPolicy
  gtmId: string | null
  ga4Id: string | null
  pixelId: string | null
  scripts: ScriptSnippet[]
}

// Ruling R3: decided once per render, from cached settings only.
export function trackingFrame(input: {
  consent: GlobalValue<"consent">
  scripts: GlobalValue<"scripts">
  tracking: PublicTracking
  preview: boolean
  scriptsDisabled: boolean
}): TrackingFrame {
  const { consent, tracking, preview } = input
  const runnable =
    preview || input.scriptsDisabled
      ? []
      : input.scripts.snippets.filter((s) => s.enabled)
  const gated = runnable.some((s) => s.category !== "necessary")
  const active =
    !preview &&
    consent.enabled &&
    Boolean(tracking.gtmId || tracking.pixelId || gated)
  return {
    active,
    policy: { version: consent.version, months: consent.reconsentMonths },
    gtmId: active ? tracking.gtmId : null,
    ga4Id: active && tracking.gtmId ? tracking.ga4Id : null,
    pixelId: active ? tracking.pixelId : null,
    scripts: active
      ? runnable
      : runnable.filter((s) => s.category === "necessary"),
  }
}

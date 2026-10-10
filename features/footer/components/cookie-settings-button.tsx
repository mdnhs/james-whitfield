"use client"

import { openConsentSettings } from "@/lib/tracking/consent-client"

export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      data-cookie-settings
      onClick={openConsentSettings}
      className="transition-opacity hover:opacity-70"
    >
      {label}
    </button>
  )
}

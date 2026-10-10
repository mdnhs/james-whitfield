import { UTM_KEYS } from "@/lib/leads/utm"

// Zod-free: the site layout runs this on every page, and reading it back
// (attribution.ts) is left to the contact form.
export const ATTRIBUTION_KEY = "mk:attribution"

// First touch wins: only the first landing of the session is stored.
export function captureAttribution(
  location: Location,
  referrer: string,
  storage: Storage
): void {
  try {
    if (storage.getItem(ATTRIBUTION_KEY)) return
    let external = ""
    try {
      if (referrer && new URL(referrer).origin !== location.origin)
        external = referrer
    } catch {}
    const params = new URLSearchParams(location.search)
    const utm: Record<string, string> = {}
    for (const key of UTM_KEYS) {
      const value = params.get(key)
      if (value) utm[key] = value.slice(0, 200)
    }
    storage.setItem(
      ATTRIBUTION_KEY,
      JSON.stringify({
        referrer: external,
        landingPath: location.pathname,
        utm,
      })
    )
  } catch {}
}

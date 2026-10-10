import type * as z from "zod"
import { Attribution, UTM_KEYS } from "@/lib/leads/schema"

const KEY = "mk:attribution"
type AttributionValue = z.infer<typeof Attribution>
const EMPTY = (): AttributionValue => Attribution.parse({})

// First touch wins: only the first landing of the session is stored.
export function captureAttribution(
  location: Location,
  referrer: string,
  storage: Storage
): void {
  try {
    if (storage.getItem(KEY)) return
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
      KEY,
      JSON.stringify({
        referrer: external,
        landingPath: location.pathname,
        utm,
      })
    )
  } catch {}
}

export function readAttribution(storage: Storage): AttributionValue {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return EMPTY()
    const parsed = Attribution.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : EMPTY()
  } catch {
    return EMPTY()
  }
}

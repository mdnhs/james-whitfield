import "server-only"

import { parseGlobal } from "@/lib/content/globals"
import { findSetting } from "@/server/modules/content/repo"

// Uncached reads for writes and for CAPI (which must see the latest consent
// revision and token). Rendering uses the cached readers instead.
export async function readTrackingSettings() {
  return parseGlobal("tracking", (await findSetting("tracking"))?.value)
}
export async function readConsentSettings() {
  return parseGlobal("consent", (await findSetting("consent"))?.value)
}

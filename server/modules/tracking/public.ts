import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { parseGlobal } from "@/lib/content/globals"
import type { PublicTracking } from "@/lib/tracking/frame"
import { GA4_ID, GTM_ID, PIXEL_ID, validId } from "@/lib/tracking/ids"
import { MISS_LIFE, tags } from "@/server/lib/cache"
import { findSetting } from "@/server/modules/content/repo"

// The public half of the `tracking` global. The token and the test code never
// enter the cache entry (docs/brief.md §6.4 "except the secrets in tracking").
// Callers must `await io()` first.
export async function getPublicTracking(): Promise<PublicTracking> {
  "use cache"
  cacheTag(tags.setting("tracking"))
  const row = await findSetting("tracking")
  if (row) cacheLife("max")
  else cacheLife(MISS_LIFE)
  const t = parseGlobal("tracking", row?.value)
  const gtmId = t.enabled.gtm ? validId(GTM_ID, t.gtmId) : null
  return {
    gtmId,
    ga4Id: gtmId && t.enabled.ga4 ? validId(GA4_ID, t.ga4Id) : null,
    pixelId: t.enabled.meta ? validId(PIXEL_ID, t.metaPixelId) : null,
  }
}

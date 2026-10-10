import "server-only"

import { PIXEL_ID, validId } from "@/lib/tracking/ids"
import { getEnv } from "@/server/env"
import { audit } from "@/server/lib/audit"
import {
  buildLeadEvent,
  capiAllowedPath,
  sendCapi,
  type LeadEventInput,
} from "@/server/lib/meta-capi"
import { CAPI_TOKEN_PURPOSE, decryptSecret } from "@/server/lib/secrets"

import { readTrackingSettings } from "./settings"

// Runs inside after() (docs/brief.md §5.5 step 4). Reads the settings fresh,
// so a token change or a switch-off applies to the very next lead.
export async function sendLeadToCapi(
  input: Omit<LeadEventInput, "siteUrl" | "enhancedMatching">
): Promise<"sent" | "skipped" | "failed"> {
  if (!capiAllowedPath(input.sourcePath)) return "skipped"
  const t = await readTrackingSettings()
  const pixelId = validId(PIXEL_ID, t.metaPixelId)
  if (!t.enabled.capi || !pixelId || !t.capiTokenEncrypted) return "skipped"
  const token = decryptSecret(t.capiTokenEncrypted, CAPI_TOKEN_PURPOSE)
  if (!token) {
    console.warn("[capi] stored token cannot be decrypted; skipped")
    return "skipped"
  }
  const event = buildLeadEvent({
    ...input,
    siteUrl: getEnv().SITE_URL,
    enhancedMatching: Boolean(
      t.enhancedMatching.enabled && t.enhancedMatching.acknowledgedAt
    ),
  })
  const result = await sendCapi({ pixelId, token, events: [event] })
  if (result.ok) return "sent"
  // Ruling R10: status only; never the token, the payload or the lead.
  await audit(null, {
    action: "tracking.capi_failed",
    entityType: "setting",
    entityId: "tracking",
    summary: `Meta Conversions API did not accept a Lead event (${
      result.status ? `HTTP ${result.status}` : "no answer"
    })`,
  })
  return "failed"
}

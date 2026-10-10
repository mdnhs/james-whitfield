import "server-only"

import { createHash } from "node:crypto"

import * as z from "zod"

import type { GlobalValue } from "@/lib/content/globals"
import { invalid } from "@/server/api/errors"
import { getDb } from "@/server/db/client"
import { consentEvents } from "@/server/db/schema"
import { readConsentSettings } from "@/server/modules/tracking/settings"

export const CONSENT_LIMIT = { limit: 20, windowMs: 10 * 60_000 }

const ConsentEventInput = z.object({
  id: z.uuid(),
  v: z.number().int().min(1).max(10_000),
  a: z.boolean(),
  m: z.boolean(),
  action: z.enum(["accept", "reject", "custom", "withdraw"]),
})

// Ruling R16: what the visitor was shown, computed here so it cannot be forged.
export function bannerHash(c: GlobalValue<"consent">) {
  const shown = [
    c.title,
    c.body,
    c.accept,
    c.reject,
    c.customise,
    c.save,
    c.policyLabel,
    c.policyHref,
    c.categories.necessary,
    c.categories.analytics,
    c.categories.marketing,
  ]
  return createHash("sha256").update(JSON.stringify(shown)).digest("hex")
}

export async function recordConsent(body: unknown) {
  const parsed = ConsentEventInput.safeParse(body)
  if (!parsed.success) throw invalid(parsed.error)
  const e = parsed.data
  await getDb()
    .insert(consentEvents)
    .values({
      consentId: e.id,
      analytics: e.a,
      marketing: e.m,
      revision: e.v,
      bannerHash: bannerHash(await readConsentSettings()),
      action: e.action,
    })
}

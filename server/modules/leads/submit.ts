import "server-only"

import * as z from "zod"

import { LeadSubmission } from "@/lib/leads/schema"
import {
  CONSENT_COOKIE,
  cookieValue,
  readConsent,
} from "@/lib/tracking/consent"
import { ApiError, invalid } from "@/server/api/errors"
import { getDb } from "@/server/db/client"
import { leadActivities, leads } from "@/server/db/schema"
import { hashEmail, hashIp } from "@/server/lib/crypto"
import { defer } from "@/server/lib/defer"
import { hitLimit } from "@/server/lib/rate-limit-db"
import { turnstileEnabled, verifyTurnstile } from "@/server/lib/turnstile"
import { getGlobal } from "@/server/modules/globals/service"
import { sendLeadToCapi } from "@/server/modules/tracking/capi"
import { readConsentSettings } from "@/server/modules/tracking/settings"

import { notifyNewLead } from "./notify"
import { allowedOptions } from "./options"
import { toE164 } from "./phone"
import { checkStamp } from "./stamp"

export const LEAD_LIMIT = { limit: 5, windowMs: 10 * 60_000 }

const cap = (n: number) =>
  z
    .string()
    .max(100_000)
    .catch("")
    .transform((v) => v.slice(0, n))
// Ruling R7: spam is kept for review, coerced, never validated.
const SpamCapture = z.object({
  name: cap(120),
  email: cap(254),
  phone: cap(40),
  topic: cap(80),
  message: cap(5000),
  sourcePath: cap(300),
})

type Ctx = {
  ip: string | null
  userAgent: string
  cookie?: string | null
  now?: Date
}

export async function submitLead(body: unknown, ctx: Ctx) {
  const now = ctx.now ?? new Date()
  const raw = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >
  const meta = {
    ipHash: ctx.ip ? hashIp(ctx.ip) : null,
    userAgent: ctx.userAgent.slice(0, 512),
  }
  // 1. The per-IP limit already ran (publicLimit). 2. Honeypot and stamp.
  const honeypot = typeof raw.website === "string" && raw.website.trim() !== ""
  const stamp = checkStamp(
    typeof raw.stamp === "string" ? raw.stamp : undefined,
    now.getTime()
  )
  if (honeypot || stamp !== "ok") {
    const s = SpamCapture.parse(raw)
    const [row] = await getDb()
      .insert(leads)
      .values({
        name: s.name,
        email: s.email,
        phone: s.phone || null,
        topicSlug: s.topic,
        message: s.message,
        sourcePath: s.sourcePath || "/",
        status: "spam",
        spamReason: honeypot ? "honeypot" : stamp,
        ...meta,
      })
      .returning({ id: leads.id })
    return { ok: true as const, leadId: row!.id }
  }
  // 3. Zod.
  const parsed = LeadSubmission.safeParse(raw)
  if (!parsed.success) throw invalid(parsed.error)
  const input = parsed.data
  // Per-email limit (needs a valid address, so it runs after Zod). Keyed on a
  // hash: the limiter table never holds the address itself.
  const byEmail = await hitLimit(
    `lead:email:${hashEmail(input.email)}`,
    LEAD_LIMIT,
    now
  )
  if (!byEmail.allowed) {
    throw new ApiError("RATE_LIMITED", "Too many requests. Try again later.")
  }
  const fieldErrors: Record<string, string[]> = {}
  const options = await allowedOptions()
  if (!options.topics.has(input.topic))
    fieldErrors.topic = ["Choose a topic from the list"]
  if (input.format && !options.formats.has(input.format))
    fieldErrors.format = ["Choose a format from the list"]
  if (input.plan && !options.plans.has(input.plan))
    fieldErrors.plan = ["Unknown plan"]
  const phone = input.phone ? toE164(input.phone) : null
  if (input.phone && !phone) fieldErrors.phone = ["Enter a valid phone number"]
  if (Object.keys(fieldErrors).length)
    throw new ApiError(
      "VALIDATION_FAILED",
      "Check the highlighted fields",
      fieldErrors
    )
  const fields = {
    name: input.name,
    email: input.email,
    phone,
    topicSlug: input.topic,
    formatSlug: input.format ?? null,
    planSlug: input.plan ?? null,
    message: input.message,
    sourcePath: input.sourcePath,
    referrer: input.attribution.referrer,
    utm: input.attribution.utm,
    metaEventId: input.eventId ?? null,
    ...meta,
  }
  // 4. Turnstile, only when configured. Ruling R17: Cloudflare's explicit "no"
  // is spam (same answer to the visitor); an unreachable siteverify lets the
  // lead in, flagged, rather than losing a real enquiry.
  // A missing token (widget blocked or failed to load) is treated like an
  // unreachable check: accepted and flagged, not spam.
  const turnstile = !turnstileEnabled()
    ? "pass"
    : !input.turnstileToken
      ? "unavailable"
      : await verifyTurnstile(input.turnstileToken, ctx.ip)
  if (turnstile === "fail") {
    const [row] = await getDb()
      .insert(leads)
      .values({ ...fields, status: "spam", spamReason: "turnstile" })
      .returning({ id: leads.id })
    return { ok: true as const, leadId: row!.id }
  }
  // Ruling R9: the cookie is the truth; the browser's flag must agree.
  const policy = await readConsentSettings()
  const choice = policy.enabled
    ? readConsent(
        cookieValue(ctx.cookie, CONSENT_COOKIE),
        { version: policy.version, months: policy.reconsentMonths },
        now.getTime()
      )
    : null
  // Any "no" wins: recorded and acted on only when both say yes.
  const marketing = choice?.marketing === true && input.marketingConsent
  const form = (await getGlobal("contactForm")).value
  const leadId = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(leads)
      .values({
        ...fields,
        privacyConsentAt: now,
        marketingConsent: marketing,
        // The server's copy of the consent text, never the client's.
        consent: {
          privacyText: form.consent,
          analytics: choice?.analytics ?? false,
          marketing,
          version: choice ? policy.version : null,
        },
        turnstileUnverified: turnstile === "unavailable",
      })
      .returning({ id: leads.id })
    if (turnstile === "unavailable") {
      await tx.insert(leadActivities).values({
        leadId: row!.id,
        type: "note",
        body: "Spam check unavailable: Cloudflare Turnstile could not be reached or produced no token, so this enquiry was accepted without verification.",
        data: { kind: "turnstile-unverified" },
      })
    }
    return row!.id
  })
  defer(() => notifyNewLead(leadId), "lead notification")
  if (marketing && input.eventId) {
    const eventId = input.eventId
    // The raw IP goes to Meta (brief §12.5) but is never stored.
    defer(
      () =>
        sendLeadToCapi({
          leadId,
          eventId,
          eventTime: now,
          sourcePath: input.sourcePath,
          ip: ctx.ip,
          userAgent: meta.userAgent,
          fbp: cookieValue(ctx.cookie, "_fbp"),
          fbc: cookieValue(ctx.cookie, "_fbc"),
          email: input.email,
          phone,
        }),
      "meta capi"
    )
  }
  return { ok: true as const, leadId }
}

import "server-only"

import { createHash } from "node:crypto"

import { sanitizePath, sanitizeUrl } from "@/lib/tracking/sanitize"

// docs/brief.md §12.5. Standard event, no custom_data, no email or phone
// unless enhanced matching is on (Ruling R12).
export const CAPI_VERSION = "v26.0"
const FB_COOKIE = /^fb\.\d\.\d{10,16}\.[\w.-]{1,200}$/
const DELAYS = [0, 1000, 4000]
const TIMEOUT_MS = 10_000

export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex")

// Never from a newsletter page (confirm/unsubscribe links carry tokens and
// reveal subscription). Matched on the collapsed, normalised path.
export function capiAllowedPath(sourcePath: string): boolean {
  if (!sourcePath.startsWith("/") || /^[/\\]{2}/.test(sourcePath)) return false
  let pathname: string
  try {
    pathname = new URL(sourcePath, "http://x").pathname
  } catch {
    return false
  }
  return !/^\/newsletter(\/|$)/.test(
    sanitizePath(pathname.endsWith("/") ? pathname : `${pathname}/`)
  )
}

export type LeadEventInput = {
  leadId: string
  eventId: string
  eventTime: Date
  sourcePath: string
  siteUrl: string
  ip: string | null
  userAgent: string
  fbp?: string
  fbc?: string
  email: string
  phone: string | null
  enhancedMatching: boolean
}

export function buildLeadEvent(i: LeadEventInput) {
  const user_data: Record<string, unknown> = {}
  if (i.ip) user_data.client_ip_address = i.ip
  if (i.userAgent) user_data.client_user_agent = i.userAgent
  if (i.fbp && FB_COOKIE.test(i.fbp)) user_data.fbp = i.fbp
  if (i.fbc && FB_COOKIE.test(i.fbc)) user_data.fbc = i.fbc
  user_data.external_id = [sha256(i.leadId)]
  if (i.enhancedMatching) {
    user_data.em = [sha256(i.email.trim().toLowerCase())]
    if (i.phone) user_data.ph = [sha256(i.phone.replace(/\D/g, ""))]
  }
  return {
    event_name: "Lead" as const,
    event_time: Math.floor(i.eventTime.getTime() / 1000),
    event_id: i.eventId,
    action_source: "website" as const,
    event_source_url: sanitizeUrl(i.sourcePath, i.siteUrl),
    user_data,
  }
}
export type CapiEvent = ReturnType<typeof buildLeadEvent>

export type CapiResult =
  { ok: true; status: number } | { ok: false; status: number; message: string }

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function sendCapi(opts: {
  pixelId: string
  token: string
  events: object[]
  testEventCode?: string
  fetchImpl?: typeof fetch
  delays?: number[]
  sleep?: (ms: number) => Promise<void>
}): Promise<CapiResult> {
  const doFetch = opts.fetchImpl ?? fetch
  const sleep = opts.sleep ?? wait
  const body = JSON.stringify({
    data: opts.events,
    access_token: opts.token,
    ...(opts.testEventCode ? { test_event_code: opts.testEventCode } : {}),
  })
  const scrub = (text: string) => text.split(opts.token).join("[token]")
  let last: CapiResult = { ok: false, status: 0, message: "Not sent" }
  for (const delay of opts.delays ?? DELAYS) {
    if (delay > 0) await sleep(delay)
    try {
      const res = await doFetch(
        `https://graph.facebook.com/${CAPI_VERSION}/${opts.pixelId}/events`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }
      )
      if (res.ok) return { ok: true, status: res.status }
      const payload = (await res.json().catch(() => ({}))) as {
        error?: { message?: unknown }
      }
      const message =
        typeof payload.error?.message === "string"
          ? scrub(payload.error.message).slice(0, 200)
          : `HTTP ${res.status}`
      last = { ok: false, status: res.status, message }
      if (res.status !== 429 && res.status < 500) return last
    } catch {
      last = { ok: false, status: 0, message: "Meta could not be reached" }
    }
  }
  return last
}

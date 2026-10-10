// The consent cookie and its rules (docs/brief.md §12.2). Isomorphic: the
// banner, the Hono routes and (as a copy in lib/tracking/bootstrap.ts, kept
// honest by bootstrap.test.ts) the inline bootstrap all follow it.
export const CONSENT_COOKIE = "mk_consent"
export const DAY_MS = 86_400_000
export const CONSENT_MAX_AGE = 180 * 86_400 // seconds (Ruling R13)
const SKEW_MS = 5 * 60_000
const MAX_RAW = 300

export type ConsentChoice = { analytics: boolean; marketing: boolean }
export type ConsentCookie = {
  id: string
  v: number
  ts: number
  a: 0 | 1
  m: 0 | 1
}
export type ConsentPolicy = { version: number; months: number }
export type ConsentAction = "accept" | "reject" | "custom" | "withdraw"

const bit = (value: unknown): value is 0 | 1 => value === 0 || value === 1

export const encodeConsent = (c: ConsentCookie) =>
  encodeURIComponent(JSON.stringify(c))

export function decodeConsent(
  raw: string | null | undefined
): ConsentCookie | null {
  if (!raw || raw.length > MAX_RAW) return null
  try {
    const v: unknown = JSON.parse(decodeURIComponent(raw))
    if (!v || typeof v !== "object" || Array.isArray(v)) return null
    const c = v as Record<string, unknown>
    if (typeof c.id !== "string" || c.id.length < 1 || c.id.length > 64)
      return null
    if (!Number.isInteger(c.v) || !Number.isInteger(c.ts)) return null
    if (!bit(c.a) || !bit(c.m)) return null
    return { id: c.id, v: c.v as number, ts: c.ts as number, a: c.a, m: c.m }
  } catch {
    return null
  }
}

// A month is 30 days, so the 6-month maximum equals the cookie's Max-Age.
export function readConsent(
  raw: string | null | undefined,
  policy: ConsentPolicy,
  nowMs: number
): ConsentChoice | null {
  const c = decodeConsent(raw)
  if (!c || c.v !== policy.version) return null
  const age = nowMs - c.ts * 1000
  if (age < -SKEW_MS || age > policy.months * 30 * DAY_MS) return null
  return { analytics: c.a === 1, marketing: c.m === 1 }
}

export function cookieValue(
  header: string | null | undefined,
  name: string
): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const at = part.indexOf("=")
    if (at > 0 && part.slice(0, at).trim() === name)
      return part.slice(at + 1).trim()
  }
  return undefined
}

export const CONSENT_DEFAULTS = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
  wait_for_update: 500,
} as const

const state = (on: boolean) => (on ? "granted" : "denied")
export function consentModeUpdate(choice: ConsentChoice) {
  return {
    analytics_storage: state(choice.analytics),
    ad_storage: state(choice.marketing),
    ad_user_data: state(choice.marketing),
    ad_personalization: state(choice.marketing),
  } as const
}

// Ruling R17: taking back anything already granted is a withdrawal.
export function actionFor(
  previous: ConsentChoice | null,
  next: ConsentChoice,
  kind: "accept" | "reject" | "custom"
): ConsentAction {
  const removed =
    (previous?.analytics && !next.analytics) ||
    (previous?.marketing && !next.marketing)
  return removed ? "withdraw" : kind
}

const TRACKING_COOKIES = [/^_ga(_|$)/, /^_gid$/, /^_gcl_/, /^_fbp$/, /^_fbc$/]
export const isTrackingCookie = (name: string) =>
  TRACKING_COOKIES.some((re) => re.test(name))

// GA and Meta write their cookies on the registrable domain; deleting needs
// the exact Domain, so try the host and each parent with two or more labels.
export function cookieDomains(hostname: string): string[] {
  const labels = hostname.split(".")
  if (labels.length < 2) return [hostname]
  const out = [hostname]
  for (let i = 0; i <= labels.length - 2; i++)
    out.push(`.${labels.slice(i).join(".")}`)
  return out
}

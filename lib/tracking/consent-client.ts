import {
  actionFor,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  consentModeUpdate,
  cookieDomains,
  cookieValue,
  decodeConsent,
  encodeConsent,
  isTrackingCookie,
  type ConsentAction,
  type ConsentChoice,
  type ConsentPolicy,
} from "./consent"

// Browser side of docs/brief.md §12.2. No React here: the banner, the Pixel
// loader and custom scripts all read and change consent through this module.
export type ConsentWindow = {
  location: { hostname: string }
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  __mkConsent?: ConsentChoice | null
  __loadGtm?: () => void
}
export type ConsentEnv = {
  window: ConsentWindow
  doc: { cookie: string }
  beacon?: (url: string, body: Blob) => boolean
  reload: () => void
  now: () => number
  newId: () => string
}

export const browserConsentEnv = (): ConsentEnv => ({
  window: window as unknown as ConsentWindow,
  doc: document,
  beacon: navigator.sendBeacon?.bind(navigator),
  reload: () => window.location.reload(),
  now: Date.now,
  newId: () => crypto.randomUUID(),
})

const listeners = new Set<() => void>()
export function subscribeConsent(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
export const getConsentSnapshot = (): ConsentChoice | null =>
  typeof window === "undefined"
    ? null
    : ((window as unknown as ConsentWindow).__mkConsent ?? null)
export const getServerConsentSnapshot = () => null

export function clearTrackingCookies(
  doc: { cookie: string },
  hostname: string
) {
  const names = doc.cookie
    .split(";")
    .map((part) => part.split("=")[0]!.trim())
    .filter(isTrackingCookie)
  for (const name of names) {
    doc.cookie = `${name}=; Max-Age=0; Path=/`
    for (const domain of cookieDomains(hostname))
      doc.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}`
  }
}

export function saveConsent(
  choice: ConsentChoice,
  kind: "accept" | "reject" | "custom",
  policy: ConsentPolicy,
  env: ConsentEnv = browserConsentEnv()
): ConsentAction {
  const w = env.window
  const action = actionFor(w.__mkConsent ?? null, choice, kind)
  const id =
    decodeConsent(cookieValue(env.doc.cookie, CONSENT_COOKIE))?.id ??
    env.newId()
  const value = encodeConsent({
    id,
    v: policy.version,
    ts: Math.floor(env.now() / 1000),
    a: choice.analytics ? 1 : 0,
    m: choice.marketing ? 1 : 0,
  })
  env.doc.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax; Secure`
  w.__mkConsent = choice
  w.gtag?.("consent", "update", consentModeUpdate(choice))
  ;(w.dataLayer ??= []).push({ event: "consent_update" })
  env.beacon?.(
    "/api/v1/public/consent",
    new Blob(
      [
        JSON.stringify({
          id,
          v: policy.version,
          a: choice.analytics,
          m: choice.marketing,
          action,
        }),
      ],
      { type: "application/json" }
    )
  )
  // A lapsed consent (window.__mkConsent null) can still leave GA/Meta cookies
  // behind, so a choice that grants nothing clears them whatever the action.
  if (action === "withdraw" || (!choice.analytics && !choice.marketing))
    clearTrackingCookies(env.doc, w.location.hostname)
  if (action === "withdraw") {
    env.reload()
    return action
  }
  if (choice.analytics || choice.marketing) w.__loadGtm?.()
  for (const listener of listeners) listener()
  return action
}

export const OPEN_CONSENT_EVENT = "mk:open-consent"
export const openConsentSettings = () =>
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))

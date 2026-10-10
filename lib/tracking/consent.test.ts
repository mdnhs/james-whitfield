import { describe, expect, it } from "vitest"

import {
  actionFor,
  CONSENT_DEFAULTS,
  consentModeUpdate,
  cookieDomains,
  cookieValue,
  DAY_MS,
  decodeConsent,
  encodeConsent,
  isTrackingCookie,
  readConsent,
} from "./consent"

const NOW = Date.UTC(2026, 9, 10, 12)
const ID = "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc"
const cookie = (over: Record<string, unknown> = {}) =>
  encodeConsent({
    id: ID,
    v: 2,
    ts: Math.floor(NOW / 1000) - 60,
    a: 1,
    m: 0,
    ...over,
  } as never)
const policy = { version: 2, months: 6 }

describe("mk_consent", () => {
  it("round-trips and reads the stored choice", () => {
    expect(decodeConsent(cookie())).toMatchObject({ id: ID, v: 2, a: 1, m: 0 })
    expect(readConsent(cookie(), policy, NOW)).toEqual({
      analytics: true,
      marketing: false,
    })
  })

  it("treats an old revision or an expired choice as no choice", () => {
    expect(readConsent(cookie({ v: 1 }), policy, NOW)).toBeNull()
    const old = Math.floor((NOW - 181 * DAY_MS) / 1000)
    expect(readConsent(cookie({ ts: old }), policy, NOW)).toBeNull()
    const edge = Math.floor((NOW - 179 * DAY_MS) / 1000)
    expect(readConsent(cookie({ ts: edge }), policy, NOW)).not.toBeNull()
    // A shorter interval set by the owner applies at once.
    const twoMonths = Math.floor((NOW - 61 * DAY_MS) / 1000)
    expect(
      readConsent(cookie({ ts: twoMonths }), { version: 2, months: 2 }, NOW)
    ).toBeNull()
  })

  it("rejects a choice dated in the future (beyond clock skew)", () => {
    const future = Math.floor((NOW + DAY_MS) / 1000)
    expect(readConsent(cookie({ ts: future }), policy, NOW)).toBeNull()
  })

  it.each([
    "%E0%A4%A",
    encodeURIComponent("[1]"),
    encodeURIComponent('{"id":"x","v":2,"ts":1,"a":"yes","m":0}'),
    encodeURIComponent('{"v":2,"ts":1,"a":1,"m":0}'),
    "x".repeat(5000),
    "",
  ])("rejects malformed cookies (%#)", (raw) => {
    expect(decodeConsent(raw)).toBeNull()
    expect(readConsent(raw, policy, NOW)).toBeNull()
  })

  it("finds a cookie in a Cookie header", () => {
    const header = `a=1; mk_consent=${cookie()}; _fbp=fb.1.2.3`
    expect(cookieValue(header, "mk_consent")).toBe(cookie())
    expect(cookieValue(header, "_fbp")).toBe("fb.1.2.3")
    expect(cookieValue(header, "missing")).toBeUndefined()
    expect(cookieValue(null, "mk_consent")).toBeUndefined()
  })
})

describe("Consent Mode v2", () => {
  it("denies everything by default except security storage", () => {
    expect(CONSENT_DEFAULTS).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "denied",
      personalization_storage: "denied",
      security_storage: "granted",
      wait_for_update: 500,
    })
  })
  it("maps categories to consent types (brief §12.2)", () => {
    expect(consentModeUpdate({ analytics: true, marketing: false })).toEqual({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    })
    expect(consentModeUpdate({ analytics: false, marketing: true })).toEqual({
      analytics_storage: "denied",
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
    })
  })
})

describe("actionFor", () => {
  const none = { analytics: false, marketing: false }
  const all = { analytics: true, marketing: true }
  it("names first choices by the button used", () => {
    expect(actionFor(null, all, "accept")).toBe("accept")
    expect(actionFor(null, none, "reject")).toBe("reject")
    expect(
      actionFor(null, { analytics: true, marketing: false }, "custom")
    ).toBe("custom")
  })
  it("calls any removal of a granted category a withdrawal", () => {
    expect(
      actionFor(all, { analytics: true, marketing: false }, "custom")
    ).toBe("withdraw")
    expect(actionFor(all, none, "reject")).toBe("withdraw")
    expect(actionFor(none, all, "accept")).toBe("accept")
  })
})

describe("withdrawal targets", () => {
  it.each(["_ga", "_ga_ABC123", "_gid", "_gcl_au", "_gcl_aw", "_fbp", "_fbc"])(
    "%s is a tracking cookie",
    (name) => expect(isTrackingCookie(name)).toBe(true)
  )
  it.each(["mk_consent", "mk.session_token", "_gat_custom", "fbp", "__ga"])(
    "%s is not",
    (name) => expect(isTrackingCookie(name)).toBe(false)
  )
  it("lists the host and every parent domain with two or more labels", () => {
    expect(cookieDomains("www.magdakennedy.ie")).toEqual([
      "www.magdakennedy.ie",
      ".www.magdakennedy.ie",
      ".magdakennedy.ie",
    ])
    expect(cookieDomains("localhost")).toEqual(["localhost"])
  })
})

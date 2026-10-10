import { runInNewContext } from "node:vm"

import { describe, expect, it } from "vitest"

import { bootstrapScript } from "./bootstrap"
import { CONSENT_DEFAULTS, DAY_MS, encodeConsent, readConsent } from "./consent"

const policy = { version: 2, months: 6 }
const SCRIPT = bootstrapScript({
  gtmId: "GTM-AB12CD3",
  ga4Id: "G-XYZ123",
  policy,
})
const ID = "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc"
const now = () => Math.floor(Date.now() / 1000)
const consent = (a: 0 | 1, m: 0 | 1, over: Record<string, unknown> = {}) =>
  `mk_consent=${encodeConsent({ id: ID, v: 2, ts: now() - 60, a, m, ...over } as never)}`

type Run = {
  window: Record<string, unknown> & { dataLayer: unknown[] }
  appended: { async?: boolean; src?: string }[]
}
function run(
  script = SCRIPT,
  {
    cookie = "",
    href = "https://site.ie/contact?topic=anxiety-stress",
    referrer = "",
    title = "Contact | Magda Kennedy",
  } = {}
): Run {
  const appended: Run["appended"] = []
  const document = {
    cookie,
    referrer,
    title,
    head: { appendChild: (el: Run["appended"][number]) => appended.push(el) },
    createElement: () => ({}),
  }
  const window = {
    location: new URL(href),
    document,
  } as unknown as Run["window"]
  runInNewContext(script, {
    window,
    document,
    URL,
    Date,
    JSON,
    RegExp,
    encodeURIComponent,
    decodeURIComponent,
  })
  return { window, appended }
}
const args = (entry: unknown) => Array.from(entry as ArrayLike<unknown>)

describe("bootstrap order (brief §12.3)", () => {
  it("sets denied defaults and ads_data_redaction first, then the page", () => {
    const { window } = run()
    const dl = window.dataLayer
    expect(args(dl[0])).toEqual(["consent", "default", CONSENT_DEFAULTS])
    expect(args(dl[1])).toEqual(["set", "ads_data_redaction", true])
    expect(dl[2]).toEqual({
      page: {
        location: "https://site.ie/contact",
        path: "/contact",
        title: "Contact | Magda Kennedy",
        referrer: "",
      },
    })
    expect(dl[3]).toEqual({ ga4_measurement_id: "G-XYZ123" })
  })

  it("never sets url_passthrough and has no noscript fallback", () => {
    expect(SCRIPT).not.toContain("url_passthrough")
    expect(SCRIPT).not.toContain("noscript")
  })
})

describe("bootstrap consent", () => {
  it("loads nothing without a choice", () => {
    const { window, appended } = run()
    expect(window.__mkConsent).toBeNull()
    expect(appended).toEqual([])
    expect(typeof window.__loadGtm).toBe("function")
  })

  it("applies a stored analytics choice and loads GTM once", () => {
    const { window, appended } = run(SCRIPT, { cookie: consent(1, 0) })
    expect(window.__mkConsent).toEqual({ analytics: true, marketing: false })
    const update = window.dataLayer.map(args).find((a) => a[1] === "update")
    expect(update).toEqual([
      "consent",
      "update",
      {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ])
    expect(appended).toEqual([
      {
        async: true,
        src: "https://www.googletagmanager.com/gtm.js?id=GTM-AB12CD3",
      },
    ])
    ;(window.__loadGtm as () => void)()
    expect(appended).toHaveLength(1)
  })

  it("a stored rejection updates to denied and loads nothing", () => {
    const { window, appended } = run(SCRIPT, { cookie: consent(0, 0) })
    expect(window.__mkConsent).toEqual({ analytics: false, marketing: false })
    expect(appended).toEqual([])
  })

  it("ignores a stale revision", () => {
    const { window, appended } = run(SCRIPT, {
      cookie: consent(1, 1, { v: 1 }),
    })
    expect(window.__mkConsent).toBeNull()
    expect(appended).toEqual([])
  })

  it("survives a broken cookie", () => {
    for (const cookie of [
      "mk_consent=%E0%A4%A",
      "mk_consent=" + encodeURIComponent("[1]"),
      "mk_consent=" + "x".repeat(5000),
    ]) {
      expect(() => run(SCRIPT, { cookie })).not.toThrow()
      expect(run(SCRIPT, { cookie }).window.__mkConsent).toBeNull()
    }
  })

  it("agrees with readConsent on every fixture", () => {
    const fixtures = [
      consent(1, 1),
      consent(0, 1),
      consent(1, 1, { v: 1 }),
      consent(1, 1, { ts: now() - 181 * 86_400 }),
      consent(1, 1, { ts: now() + 86_400 }),
      consent(1, 1, { a: 2 }),
      consent(1, 1, { id: "" }),
      "mk_consent=%E0%A4%A",
      "other=1",
    ]
    for (const cookie of fixtures) {
      const raw = cookie.startsWith("mk_consent=")
        ? cookie.slice("mk_consent=".length)
        : undefined
      expect(
        run(SCRIPT, { cookie: `a=1; ${cookie}` }).window.__mkConsent
      ).toEqual(readConsent(raw, policy, Date.now()))
    }
    expect(DAY_MS).toBe(86_400_000)
  })
})

describe("bootstrap sanitising (Rulings R6, R8)", () => {
  it("pushes a sanitised page for articles, newsletter links and referrers", () => {
    const article = run(SCRIPT, {
      href: "https://site.ie/insights/hypnosis-for-panic#top",
      title: "Hypnosis for panic | MK",
      referrer: "https://www.google.com/search?q=panic+attack+help",
    })
    expect(article.window.dataLayer[2]).toEqual({
      page: {
        location: "https://site.ie/insights",
        path: "/insights",
        title: "Insights",
        referrer: "https://www.google.com/search",
      },
    })
    const newsletter = run(SCRIPT, {
      href: "https://site.ie/newsletter/unsubscribe?token=abc.def",
    })
    expect(JSON.stringify(newsletter.window.dataLayer)).not.toContain("token")
  })
})

describe("bootstrap sanitising agrees with sanitize.ts on variants", () => {
  it.each([
    "/insights%2Fslug",
    "/Insights/Slug",
    "/insights%252Fslug",
    "//insights//slug",
  ])("collapses %s", (path) => {
    const r = run(SCRIPT, { href: `https://site.ie${path}`, title: "Secret" })
    expect(r.window.dataLayer[2]).toMatchObject({
      page: {
        location: "https://site.ie/insights",
        path: "/insights",
        title: "Insights",
      },
    })
  })
  it("blanks protocol-relative and script referrers", () => {
    for (const referrer of ["//evil.example/x", "javascript:alert(1)"]) {
      const r = run(SCRIPT, { href: "https://site.ie/about", referrer })
      expect(r.window.dataLayer[2]).toMatchObject({ page: { referrer: "" } })
    }
  })
})

describe("bootstrap safety (Review Focus 4)", () => {
  it("drops invalid IDs and escapes </script>", () => {
    const script = bootstrapScript({
      gtmId: "GTM-A</script><script>alert(1)</script>",
      ga4Id: "g-lower",
      policy,
    })
    expect(script.toLowerCase()).not.toMatch(/<\/script|<!--/)
    // The embedded config holds no "<" at all (the body's loops may).
    const config = script.slice(
      script.indexOf("var C="),
      script.indexOf("};") + 1
    )
    expect(config).not.toContain("<")
    const { window, appended } = run(script, { cookie: consent(1, 1) })
    expect(appended).toEqual([])
    expect(window.dataLayer).not.toContainEqual({
      ga4_measurement_id: "g-lower",
    })
  })
})

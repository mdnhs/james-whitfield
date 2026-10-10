import { describe, expect, it } from "vitest"

import { buildCsp, CSP_REPORT_PATH, securityHeaders } from "./csp"

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.split(" ")
    .slice(1) ?? []

describe("buildCsp (brief §12.6, Ruling R1)", () => {
  const csp = buildCsp({ dev: false, mediaOrigin: "https://media.example.com" })

  it("allows exactly the vendors the site uses", () => {
    expect(directive(csp, "script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      "https://www.googletagmanager.com",
      "https://connect.facebook.net",
      "https://challenges.cloudflare.com",
    ])
    for (const host of [
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://www.google.com",
      "https://www.google.ie",
      "https://www.facebook.com",
    ]) {
      expect(directive(csp, "connect-src")).toContain(host)
      expect(directive(csp, "img-src")).toContain(host)
    }
    expect(directive(csp, "img-src")).toContain("https://media.example.com")
    expect(directive(csp, "frame-src")).toEqual([
      "'self'",
      "https://www.googletagmanager.com",
      "https://challenges.cloudflare.com",
    ])
  })

  it("locks down the rest", () => {
    expect(directive(csp, "object-src")).toEqual(["'none'"])
    expect(directive(csp, "base-uri")).toEqual(["'self'"])
    expect(directive(csp, "form-action")).toEqual(["'self'"])
    expect(directive(csp, "frame-ancestors")).toEqual(["'self'"])
    expect(directive(csp, "report-uri")).toEqual([CSP_REPORT_PATH])
  })

  it("uses no nonce, and unsafe-eval only in development", () => {
    expect(csp).not.toMatch(/nonce-|unsafe-eval/)
    expect(
      directive(buildCsp({ dev: true, mediaOrigin: null }), "script-src")
    ).toContain("'unsafe-eval'")
  })

  it("adds allowlisted custom-code hosts to script-src and connect-src", () => {
    const withHost = buildCsp({
      dev: false,
      mediaOrigin: null,
      customHosts: ["widget.example.org"],
    })
    expect(directive(withHost, "script-src")).toContain(
      "https://widget.example.org"
    )
    expect(directive(withHost, "connect-src")).toContain(
      "https://widget.example.org"
    )
  })
})

describe("securityHeaders (Ruling R20)", () => {
  const rules = securityHeaders({ dev: false, mediaOrigin: null })
  const find = (key: string) =>
    rules.filter((r) => r.headers.some((h) => h.key === key))

  it("enforces the CSP on every path and still asks for reports", () => {
    const [rule] = find("Content-Security-Policy")
    expect(rule!.source).toBe("/:path*")
    expect(find("Content-Security-Policy-Report-Only")).toHaveLength(0)
    const value = rule!.headers.find(
      (h) => h.key === "Content-Security-Policy"
    )!.value
    expect(value).toContain("report-uri /api/v1/public/csp-report")
    expect(value).not.toContain("'unsafe-eval'")
  })

  it("sends the brief's security headers", () => {
    const all = Object.fromEntries(
      rules.flatMap((r) => r.headers.map((h) => [h.key, h.value]))
    )
    expect(all).toMatchObject({
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Robots-Tag": "noindex, nofollow",
    })
  })

  it("leaves the reset page's no-referrer to proxy and tags only /api for robots", () => {
    const [referrer] = find("Referrer-Policy")
    expect(referrer!.source).toBe("/((?!admin/reset-password).*)")
    const [robots] = find("X-Robots-Tag")
    expect(robots!.source).toBe("/api/:path*")
  })
})

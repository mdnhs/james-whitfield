import { CUSTOM_SCRIPT_HOSTS } from "./hosts"

// docs/brief.md §12.6 and §15. Allowlist, no nonce (Ruling R1):
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
// "Static vs Dynamic Rendering with CSP" and "Without Nonces".
export const CSP_REPORT_PATH = "/api/v1/public/csp-report"

const GOOGLE = [
  "https://www.googletagmanager.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  // Each Google TLD separately (brief §12.6); signals and ads are off.
  "https://www.google.com",
  "https://www.google.ie",
]
const META = ["https://www.facebook.com"]

type Opts = {
  dev: boolean
  mediaOrigin: string | null
  customHosts?: readonly string[]
}

export function buildCsp({
  dev,
  mediaOrigin,
  customHosts = CUSTOM_SCRIPT_HOSTS,
}: Opts) {
  const custom = customHosts.map((h) => `https://${h}`)
  const media = mediaOrigin ? [mediaOrigin] : []
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(dev ? ["'unsafe-eval'"] : []),
      "https://www.googletagmanager.com",
      "https://connect.facebook.net",
      "https://challenges.cloudflare.com",
      ...custom,
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...GOOGLE, ...META, ...media],
    "font-src": ["'self'"],
    "connect-src": [
      "'self'",
      ...GOOGLE,
      ...META,
      "https://connect.facebook.net",
      ...media,
      ...custom,
    ],
    "frame-src": [
      "'self'",
      "https://www.googletagmanager.com",
      "https://challenges.cloudflare.com",
    ],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'self'"],
    "report-uri": [CSP_REPORT_PATH],
  }
  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ")
}

export function securityHeaders(opts: Opts) {
  return [
    {
      source: "/:path*",
      headers: [
        // Report-Only until Phase 10 enforces it (brief §12.6).
        { key: "Content-Security-Policy-Report-Only", value: buildCsp(opts) },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
    {
      // proxy.ts sends no-referrer on the reset page (its URL holds a token).
      source: "/((?!admin/reset-password).*)",
      headers: [
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
    {
      source: "/api/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    },
  ]
}

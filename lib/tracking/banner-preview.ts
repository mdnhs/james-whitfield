import type React from "react"

// The site variables ConsentBannerView reads, so the admin can preview it.
// Same values as `@theme` in app/(site)/site.css (banner-preview.test.ts).
export const BANNER_PREVIEW_STYLE = {
  "--color-cream": "#faf6f0",
  "--color-pine": "#1e4f50",
  "--color-line": "#dfe2d8",
  "--font-display": "var(--font-fraunces)",
} as React.CSSProperties

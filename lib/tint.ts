import type { CSSProperties } from "react"

// A tint is a number (0–1) so it can come from the database. This is the
// exact colour Tailwind 4 emits for `bg-pine/90` in browsers with color-mix,
// so swapping the class for this style changes no pixel.
export function tintStyle(tint: number, token = "pine"): CSSProperties {
  const percent = Math.round(Math.min(1, Math.max(0, tint)) * 1000) / 10
  return {
    backgroundColor: `color-mix(in oklab, var(--color-${token}) ${percent}%, transparent)`,
  }
}

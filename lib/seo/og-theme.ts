import type { OgColors } from "@/lib/seo/og-card"
import { toHex } from "@/lib/theme/color"
import type { SiteThemeConfig } from "@/lib/theme/schema"
import { resolveSiteTokens } from "@/lib/theme/site"

// Satori takes plain colours, so the card gets hex.
export function ogColors(site: SiteThemeConfig): OgColors {
  const t = resolveSiteTokens(site)
  return {
    background: toHex(t.ink),
    text: toHex(t.cream),
    accent: toHex(t["brand-mint"]),
  }
}

// lib/theme/site.ts
import { parseColor, type Oklch } from "./color"
import { shift } from "./derive"
import { PRESETS, TEAL_SAGE_SITE, type PresetId } from "./presets"
import type { SiteThemeConfig } from "./schema"
import { SITE_TOKENS, type SiteToken } from "./tokens"

type SiteTokens = Record<SiteToken, Oklch>

const table = (hex: Record<SiteToken, string>) =>
  Object.fromEntries(
    SITE_TOKENS.map((t) => [t, parseColor(hex[t])!])
  ) as SiteTokens

const BASE = table(TEAL_SAGE_SITE)

// clay is the site's accent: presets set it, brands never move it (R2).
function derived(from: SiteTokens, brand: Oklch, clay: Oklch): SiteTokens {
  return Object.fromEntries(
    SITE_TOKENS.map((t) => [
      t,
      t === "brand"
        ? brand
        : t === "clay"
          ? clay
          : shift(from[t], from.brand, brand, true),
    ])
  ) as SiteTokens
}

const PRESET_TABLES = Object.fromEntries(
  (Object.keys(PRESETS) as PresetId[]).map((id) => {
    const { brand, clay } = PRESETS[id].site
    return [
      id,
      derived(BASE, parseColor(brand)!, clay ? parseColor(clay)! : BASE.clay),
    ]
  })
) as Record<PresetId, SiteTokens>

// Stored values are canonical; a value that somehow fails to parse falls
// back to the preset's, so rendering never throws.
export function resolveSiteTokens(site: SiteThemeConfig): SiteTokens {
  const preset = PRESET_TABLES[site.preset] ?? PRESET_TABLES["teal-sage"]
  const brand = (site.brand && parseColor(site.brand)) || preset.brand
  const out = derived(preset, brand, preset.clay)
  for (const t of SITE_TOKENS) {
    const locked = site.tokens[t]
    const color = locked ? parseColor(locked) : null
    if (color) out[t] = color
  }
  return out
}

export const SITE_DEFAULT: SiteTokens = PRESET_TABLES["teal-sage"]

export const presetSiteTheme = (preset: PresetId): SiteThemeConfig => ({
  preset,
  brand: null,
  tokens: {},
})

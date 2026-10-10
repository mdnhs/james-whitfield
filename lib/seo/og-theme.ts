import type { GlobalValue } from "@/lib/content/globals"

// app/(site)/site.css @theme values (og-theme.test.ts keeps them in step).
export const OG_DEFAULTS = {
  ink: "#030303",
  cream: "#faf6f0",
  "brand-mint": "#d6e8e4",
} as const

export function ogColors(theme: GlobalValue<"theme">["site"]) {
  return {
    background: theme.ink ?? OG_DEFAULTS.ink,
    text: theme.cream ?? OG_DEFAULTS.cream,
    accent: theme["brand-mint"] ?? OG_DEFAULTS["brand-mint"],
  }
}

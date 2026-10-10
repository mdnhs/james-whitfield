// lib/theme/presets.ts
import type { AdminToken, SiteToken } from "./tokens"

export const PRESET_IDS = [
  "teal-sage",
  "evergreen",
  "ocean",
  "plum",
  "terracotta",
  "graphite",
] as const
export type PresetId = (typeof PRESET_IDS)[number]

// Today's site palette, verbatim from app/(site)/site.css @theme
// (tests/css/theme-presets.test.ts keeps them equal).
export const TEAL_SAGE_SITE: Record<SiteToken, string> = {
  brand: "#336060",
  "brand-mint": "#d6e8e4",
  cream: "#faf6f0",
  "brand-deep": "#245f60",
  clay: "#b55441",
  stone: "#f3f4ee",
  mist: "#d9e5e5",
  forest: "#245333",
  pine: "#1e4f50",
  ink: "#030303",
  "ink-muted": "#3d3d3d",
  "text-strong": "#0c0c0c",
  "text-muted": "#525252",
  "text-subtle": "#8a8f88",
  line: "#dfe2d8",
  "line-soft": "#e7e9e0",
  "line-neutral": "#ececec",
  "line-faint": "#f2f2f2",
  "line-rule": "#d8dccf",
  "surface-soft": "#f8f9f5",
  "surface-warm": "#fcfaf7",
  "hero-base": "#0d120f",
  moss: "#315d44",
  spruce: "#002620",
}

// Evergreen, verbatim from app/(admin)/admin.css. Dark lists only what the
// .dark block overrides; everything else falls back to light, as in CSS.
export const EVERGREEN_ADMIN: {
  radius: number
  light: Record<AdminToken, string>
  dark: Partial<Record<AdminToken, string>>
} = {
  radius: 0.75,
  light: {
    background: "#ffffff",
    foreground: "#111411",
    card: "#ffffff",
    "card-foreground": "#111411",
    popover: "#ffffff",
    "popover-foreground": "#111411",
    primary: "#157d38",
    "primary-foreground": "#ffffff",
    secondary: "#e9ece9",
    "secondary-foreground": "#111411",
    muted: "#eef0ee",
    "muted-foreground": "#666c67",
    accent: "#e6f4eb",
    "accent-foreground": "#14532d",
    destructive: "#dc2626",
    border: "#e5e8e5",
    input: "#7d867e",
    ring: "#22a055",
    "chart-1": "#1e6b35",
    "chart-2": "#3f9d5e",
    "chart-3": "#6cc08c",
    "chart-4": "#2f4f38",
    "chart-5": "#a7d9b8",
    sidebar: "#f2f3f2",
    "sidebar-foreground": "#111411",
    "sidebar-primary": "#157d38",
    "sidebar-primary-foreground": "#ffffff",
    "sidebar-accent": "#e6f4eb",
    "sidebar-accent-foreground": "#14532d",
    "sidebar-border": "#e5e8e5",
    "sidebar-ring": "#22a055",
    success: "#15803d",
    "success-soft": "#dcfce7",
    warning: "#b45309",
    "warning-soft": "#fef3c7",
    danger: "#b91c1c",
    "danger-soft": "#fee2e2",
    skeleton: "#e2e6e2",
    hatch: "#8fcca5",
    "hero-from": "#0f4d23",
    "hero-to": "#2b6e3e",
    "hero-foreground": "#ffffff",
    "hero-chip": "#ffffff",
    "hero-chip-foreground": "#111411",
    "hero-delta": "#a6f0bd",
    "promo-from": "#06120a",
    "promo-to": "#12381f",
    "promo-foreground": "#ffffff",
  },
  dark: {
    background: "#0c100d",
    foreground: "#eef2ee",
    card: "#1c251f",
    "card-foreground": "#eef2ee",
    popover: "#1c251f",
    "popover-foreground": "#eef2ee",
    primary: "#34b567",
    "primary-foreground": "#06130a",
    secondary: "#1c241e",
    "secondary-foreground": "#eef2ee",
    muted: "#1c241e",
    "muted-foreground": "#9aa39c",
    accent: "#18301f",
    "accent-foreground": "#c9ecd6",
    destructive: "#f87171",
    border: "#243026",
    input: "#667369",
    ring: "#3fcb75",
    "chart-1": "#3fcb75",
    "chart-2": "#6cc08c",
    "chart-3": "#a7d9b8",
    "chart-4": "#2f7a45",
    "chart-5": "#1f4a2b",
    sidebar: "#141b16",
    "sidebar-foreground": "#eef2ee",
    "sidebar-primary": "#34b567",
    "sidebar-primary-foreground": "#06130a",
    "sidebar-accent": "#18301f",
    "sidebar-accent-foreground": "#c9ecd6",
    "sidebar-border": "#243026",
    "sidebar-ring": "#3fcb75",
    success: "#4ade80",
    "success-soft": "#12301c",
    warning: "#fbbf24",
    "warning-soft": "#33270c",
    danger: "#f87171",
    "danger-soft": "#3a1414",
    skeleton: "#2a352d",
    "hero-chip": "#ffffff",
    "hero-chip-foreground": "#111411",
    "hero-delta": "#a6f0bd",
    hatch: "#2f7a45",
  },
}

// Ruling R3. Every preset is one shift from the base tables above.
export const PRESETS: Record<
  PresetId,
  {
    label: string
    site: { brand: string; clay?: string }
    admin: { primary: string }
  }
> = {
  "teal-sage": {
    label: "Teal Sage",
    site: { brand: "#336060" },
    admin: { primary: "#336060" },
  },
  evergreen: {
    label: "Evergreen",
    site: { brand: "#1f6b3a" },
    admin: { primary: "#157d38" },
  },
  ocean: {
    label: "Ocean",
    site: { brand: "#2f5f8a", clay: "#a8553a" },
    admin: { primary: "#2f5f8a" },
  },
  plum: {
    label: "Plum",
    site: { brand: "#6a3f6b", clay: "#a8553a" },
    admin: { primary: "#6a3f6b" },
  },
  terracotta: {
    label: "Terracotta",
    site: { brand: "#8f4a36", clay: "#4f6b5a" },
    admin: { primary: "#9a4a32" },
  },
  graphite: {
    label: "Graphite",
    site: { brand: "#4a4f55" },
    admin: { primary: "#4a4f55" },
  },
}

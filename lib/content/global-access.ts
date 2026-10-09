import type { Permissions } from "@/lib/auth/permissions"

import type { GlobalKey } from "./globals"

// The keys the generic globals API edits (docs/brief.md §6.4). tracking,
// consent, scripts and theme have dedicated endpoints (Phases 8–9).
export const EDITABLE_GLOBAL_KEYS = [
  "site",
  "contact",
  "navigation",
  "footer",
  "newsletter",
  "contactForm",
  "microcopy",
  "seo",
  "notifications",
  "privacy",
] as const satisfies readonly GlobalKey[]
export type EditableGlobalKey = (typeof EDITABLE_GLOBAL_KEYS)[number]

type Access = { read: Permissions; update: Permissions }
const settingsAccess = {
  read: { settings: ["read"] },
  update: { settings: ["update"] },
} satisfies Access
const globalsAccess = {
  read: { globals: ["read"] },
  update: { globals: ["update"] },
} satisfies Access

export const GLOBAL_ACCESS: Record<EditableGlobalKey, Access> = {
  site: settingsAccess,
  notifications: settingsAccess,
  privacy: settingsAccess,
  contact: globalsAccess,
  navigation: globalsAccess,
  footer: globalsAccess,
  newsletter: globalsAccess,
  contactForm: globalsAccess,
  microcopy: globalsAccess,
  seo: { read: { seo: ["read"] }, update: { seo: ["update"] } },
}

// /admin/settings/<slug> (lib/admin/nav.ts) → the documents it edits.
export const SETTINGS_PAGES = {
  identity: ["site"],
  contact: ["contact"],
  navigation: ["navigation"],
  footer: ["footer"],
  forms: ["contactForm", "newsletter", "microcopy"],
  notifications: ["notifications"],
  privacy: ["privacy"],
} as const satisfies Record<string, readonly EditableGlobalKey[]>
export type SettingsPage = keyof typeof SETTINGS_PAGES

export const SETTINGS_PAGE_LABELS: Record<SettingsPage, string> = {
  identity: "Identity",
  contact: "Contact & clinic",
  navigation: "Navigation",
  footer: "Footer",
  forms: "Forms & microcopy",
  notifications: "Notifications",
  privacy: "Privacy",
}

export const GLOBAL_LABELS: Record<EditableGlobalKey, string> = {
  site: "Identity",
  contact: "Contact & clinic",
  navigation: "Navigation",
  footer: "Footer",
  newsletter: "Newsletter band",
  contactForm: "Contact form",
  microcopy: "Microcopy",
  seo: "SEO defaults",
  notifications: "Notifications",
  privacy: "Privacy",
}

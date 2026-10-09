import "server-only"

import {
  CONTACT,
  CONTACT_FORM,
} from "@/server/db/seed/fixtures/contact-content"
import { FOOTER } from "@/server/db/seed/fixtures/footer-links"
import { HERO_CONTENT } from "@/server/db/seed/fixtures/hero-content"
import { NEWSLETTER } from "@/server/db/seed/fixtures/articles"
import { NAVIGATION } from "@/server/db/seed/fixtures/nav-links"
import { MICROCOPY } from "@/server/db/seed/fixtures/microcopy"
import { SITE } from "@/server/db/seed/fixtures/site"
import { parseGlobal, SITE_TOKENS, type GlobalKey } from "@/lib/content/globals"
import type { Db } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { mediaRef } from "./media"

// Today's palette (app/(site)/site.css @theme), published as the site theme.
const SITE_THEME: Record<(typeof SITE_TOKENS)[number], string> = {
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

const VALUES: Record<GlobalKey, unknown> = {
  site: { ...SITE, logo: mediaRef("/images/hero/logo-mark.svg") },
  // The clinic photo lives on the `contact.clinic` block (the only place a
  // component reads it); the global keeps none.
  contact: CONTACT,
  navigation: NAVIGATION,
  footer: FOOTER,
  newsletter: { ...NEWSLETTER, image: mediaRef(NEWSLETTER.image) },
  contactForm: CONTACT_FORM,
  microcopy: MICROCOPY,
  seo: {
    titleTemplate: `%s | ${SITE.name}`,
    defaultTitle: `${SITE.name}: ${SITE.professionalTitle}`,
    defaultDescription: HERO_CONTENT.description,
    business: { type: "ProfessionalService", priceRange: "€€" },
  },
  tracking: {},
  consent: {},
  scripts: {},
  theme: { site: SITE_THEME, admin: {} },
  notifications: {},
  privacy: {},
}

export async function seedGlobals(db: Db) {
  const rows = (Object.keys(VALUES) as GlobalKey[]).map((key) => ({
    key,
    value: parseGlobal(key, VALUES[key]),
  }))
  await db.insert(settings).values(rows).onConflictDoNothing()
  return rows.length
}

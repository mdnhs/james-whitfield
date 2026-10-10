import "server-only"

import {
  CONTACT,
  CONTACT_FORM,
} from "@/server/db/seed/fixtures/contact-content"
import { consentCopy } from "@/server/db/seed/fixtures/consent"
import { FOOTER } from "@/server/db/seed/fixtures/footer-links"
import { HERO_CONTENT } from "@/server/db/seed/fixtures/hero-content"
import { NEWSLETTER } from "@/server/db/seed/fixtures/articles"
import { NAVIGATION } from "@/server/db/seed/fixtures/nav-links"
import { MICROCOPY } from "@/server/db/seed/fixtures/microcopy"
import { SITE } from "@/server/db/seed/fixtures/site"
import { parseGlobal, type GlobalKey } from "@/lib/content/globals"
import type { Db } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { mediaRef } from "./media"

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
  consent: consentCopy,
  scripts: {},
  theme: {},
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

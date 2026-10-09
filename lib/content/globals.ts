// lib/content/globals.ts
import * as z from "zod"

import { Href, HttpsUrl, MediaRef } from "@/blocks/fields"

const s = (max: number) => z.string().trim().max(max).default("")
const Link = z.object({
  label: s(60),
  href: Href.or(z.literal("")).default(""),
})
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
// ISO weekday: 1 = Monday … 7 = Sunday.
const Day = z.number().int().min(1).max(7)
const Hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a #rrggbb colour")

// Site colour tokens the theme can override (app/(site)/site.css @theme).
export const SITE_TOKENS = [
  "brand",
  "brand-mint",
  "cream",
  "brand-deep",
  "clay",
  "stone",
  "mist",
  "forest",
  "pine",
  "ink",
  "ink-muted",
  "text-strong",
  "text-muted",
  "text-subtle",
  "line",
  "line-soft",
  "line-neutral",
  "line-faint",
  "line-rule",
  "surface-soft",
  "surface-warm",
  "hero-base",
  "moss",
  "spruce",
] as const

export const SiteGlobal = z.object({
  name: s(80),
  legalName: s(120),
  professionalTitle: s(120),
  logo: MediaRef.nullable().default(null),
  icon: MediaRef.nullable().default(null),
  locale: z.literal("en-IE").default("en-IE"),
  timeZone: z.literal("Europe/Dublin").default("Europe/Dublin"),
  social: z
    .array(z.object({ label: s(40), url: HttpsUrl }))
    .max(10)
    .default([]),
})

export const ContactGlobal = z.object({
  email: z.email().or(z.literal("")).default(""),
  phone: z
    .object({
      display: s(40),
      e164: z
        .string()
        .regex(/^(\+[1-9]\d{6,14})?$/, "Use E.164, e.g. +35312345678")
        .default(""),
    })
    .prefault({}),
  address: z
    .object({
      lines: z.array(s(80)).max(4).default([]),
      city: s(60),
      eircode: s(10),
      country: s(60),
    })
    .prefault({}),
  hours: z
    .object({
      weekly: z
        .array(
          z.object({
            days: z.array(Day).min(1).max(7),
            opens: Time,
            closes: Time,
          })
        )
        .max(7)
        .default([]),
      // How the site prints the hours; the structured list feeds JSON-LD (Phase 7).
      summary: s(120),
      note: s(200),
    })
    .prefault({}),
  clinic: z
    .object({
      name: s(80),
      description: s(400),
      photo: MediaRef.nullable().default(null),
      onlineNote: s(200),
      geo: z
        .object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
        })
        .nullable()
        .default(null),
    })
    .prefault({}),
})

export const NavigationGlobal = z.object({
  links: z.array(Link).max(7).default([]),
  cta: Link.prefault({}),
})

export const FooterGlobal = z.object({
  blurb: s(300),
  columns: z
    .array(
      z.object({
        title: s(40),
        // "navigation" appends the header links after `links` (auto sitemap).
        source: z.enum(["navigation", "links"]).default("links"),
        links: z.array(Link).max(10).default([]),
      })
    )
    .max(4)
    .default([]),
  contactLines: z.array(s(80)).max(4).default([]),
  contactNote: s(200),
  legalLinks: z.array(Link).max(6).default([]),
  copyrightName: s(80),
})

export const NewsletterGlobal = z.object({
  eyebrow: s(40),
  title: s(120),
  subtitle: s(240),
  emailLabel: s(40),
  placeholder: s(60),
  button: s(30),
  success: s(200),
  image: MediaRef.nullable().default(null),
  tint: z.number().min(0).max(0.9).default(0.9),
  confirmationEmail: z.object({ subject: s(120), body: s(2000) }).prefault({}),
})

export const ContactFormGlobal = z.object({
  title: s(80),
  labels: z
    .object({
      name: s(40),
      email: s(40),
      phone: s(40),
      topic: s(60),
      format: s(40),
      message: s(40),
    })
    .prefault({}),
  placeholders: z
    .object({
      name: s(60),
      email: s(60),
      phone: s(30),
      topic: s(60),
      message: s(160),
    })
    .prefault({}),
  // Topics beyond the services collection ("Something else").
  extraTopics: z.array(s(60)).max(4).default([]),
  formats: z.array(s(60)).max(6).default([]),
  consent: s(300),
  button: s(40),
  sendAnother: s(40),
  success: z.object({ title: s(120), body: s(300) }).prefault({}),
  errors: z
    .object({ name: s(80), email: s(80), topic: s(80), consent: s(80) })
    .prefault({}),
  // "{name}", "{price}" and "{unit}" come from the plan in ?plan=.
  planMessage: s(200),
})

export const MicrocopyGlobal = z.object({
  breadcrumbHome: s(30),
  breadcrumbInsights: s(30),
  featured: s(30),
  featuredLabel: s(40),
  readArticle: s(40),
  // "{minutes}" is replaced.
  readTime: s(30),
  allArticles: s(30),
  filterLabel: s(40),
  searchLabel: s(40),
  searchPlaceholder: s(40),
  // "{shown}" and "{total}" are replaced.
  showing: s(60),
  noResults: s(80),
  clearFilters: s(30),
  pagination: s(30),
  previousPage: s(30),
  nextPage: s(30),
  // "{n}" is replaced.
  pageLabel: s(30),
  writtenBy: s(30),
  share: s(30),
  copyLink: s(30),
  linkCopied: s(30),
  shareEmail: s(30),
  allInsights: s(40),
  keepReading: s(40),
  viewAllInsights: s(40),
  articleCta: z
    .object({ title: s(80), body: s(300), button: s(40) })
    .prefault({}),
  directions: s(40),
  contactChannels: z
    .object({ email: s(20), phone: s(20), clinic: s(20), hours: s(20) })
    .prefault({}),
  contactChapter: s(24),
  articleChapters: z
    .object({
      welcome: s(24),
      article: s(24),
      keepReading: s(24),
      newsletter: s(24),
    })
    .prefault({}),
})

export const SeoGlobal = z.object({
  titleTemplate: z
    .string()
    .max(60)
    .refine((v) => v === "" || v.includes("%s"), 'The template needs "%s"')
    .default(""),
  defaultTitle: s(70),
  defaultDescription: s(200),
  defaultOgImage: MediaRef.nullable().default(null),
  robots: z.enum(["index", "noindex"]).default("index"),
  verification: z.object({ google: s(100), bing: s(100) }).prefault({}),
  business: z
    .object({
      type: z
        .enum(["ProfessionalService", "LocalBusiness"])
        .default("ProfessionalService"),
      priceRange: s(10),
      sameAs: z.array(HttpsUrl).max(10).default([]),
    })
    .prefault({}),
})

export const TrackingGlobal = z.object({
  gtmId: s(20),
  ga4Id: s(20),
  metaPixelId: s(20),
  // Encrypted at rest (Phase 8); never sent to the browser.
  capiTokenEncrypted: z.string().nullable().default(null),
  testEventCode: s(40),
  enabled: z
    .object({
      gtm: z.boolean().default(false),
      ga4: z.boolean().default(false),
      meta: z.boolean().default(false),
      capi: z.boolean().default(false),
    })
    .prefault({}),
})

export const ConsentGlobal = z.object({
  enabled: z.boolean().default(false),
  title: s(80),
  body: s(600),
  accept: s(30),
  reject: s(30),
  customise: s(30),
  policyHref: Href.or(z.literal("")).default(""),
  categories: z.object({ analytics: s(300), marketing: s(300) }).prefault({}),
  reconsentMonths: z.number().int().min(1).max(24).default(12),
  version: z.number().int().min(1).default(1),
})

export const ScriptsGlobal = z.object({
  snippets: z
    .array(
      z.object({
        name: s(60),
        placement: z.enum(["head", "body-start", "body-end"]),
        category: z.enum(["necessary", "analytics", "marketing"]),
        code: z.string().max(20_000),
      })
    )
    .max(20)
    .default([]),
})

export const ThemeGlobal = z.object({
  // Written into a <style> tag by SiteFrame, so only #rrggbb is accepted.
  site: z.partialRecord(z.enum(SITE_TOKENS), Hex).default({}),
  // Admin tokens arrive with the theme engine (Phase 9).
  admin: z.record(z.string(), Hex).default({}),
})

export const NotificationsGlobal = z.object({
  recipients: z.array(z.email()).max(10).default([]),
  autoReply: z
    .object({
      enabled: z.boolean().default(false),
      subject: s(120),
      body: s(2000),
    })
    .prefault({}),
})

export const PrivacyGlobal = z.object({
  enquiryRetentionMonths: z.number().int().min(1).max(120).default(24),
  newsletterDoubleOptIn: z.boolean().default(true),
  ipSaltRotatedAt: z.iso.datetime().nullable().default(null),
})

export const GLOBALS = {
  site: SiteGlobal,
  contact: ContactGlobal,
  navigation: NavigationGlobal,
  footer: FooterGlobal,
  newsletter: NewsletterGlobal,
  contactForm: ContactFormGlobal,
  microcopy: MicrocopyGlobal,
  seo: SeoGlobal,
  tracking: TrackingGlobal,
  consent: ConsentGlobal,
  scripts: ScriptsGlobal,
  theme: ThemeGlobal,
  notifications: NotificationsGlobal,
  privacy: PrivacyGlobal,
} as const

export type GlobalKey = keyof typeof GLOBALS
export type GlobalValue<K extends GlobalKey> = z.infer<(typeof GLOBALS)[K]>

// Read by public rendering. Tracking secrets and operator-only settings stay
// out (docs/brief.md §6.4).
export const PUBLIC_GLOBAL_KEYS = [
  "site",
  "contact",
  "navigation",
  "footer",
  "newsletter",
  "contactForm",
  "microcopy",
  "seo",
  "consent",
  "scripts",
  "theme",
] as const satisfies readonly GlobalKey[]
export type PublicGlobalKey = (typeof PUBLIC_GLOBAL_KEYS)[number]

export function parseGlobal<K extends GlobalKey>(
  key: K,
  value: unknown
): GlobalValue<K> {
  return GLOBALS[key].parse(value ?? {}) as GlobalValue<K>
}

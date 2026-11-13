import * as z from "zod"

import {
  HttpsUrl,
  IconField,
  LinkValue,
  MediaRef,
  Tint,
  text,
} from "@/blocks/fields"

import { Slug } from "./slug"

// The collections the generic API edits (docs/brief.md §6.3, §8.3); slugs
// are the admin URLs (lib/admin/nav.ts). Articles, categories and authors
// get their own API in Phase 5.
export const COLLECTION_NAMES = [
  "services",
  "plans",
  "testimonials",
  "faqs",
  "steps",
  "cta-bands",
] as const
export type CollectionSlug = (typeof COLLECTION_NAMES)[number]
// Read-only choices for the collection picker.
export type OptionSource = CollectionSlug | "articles"

// The image box relative to the step's media slot, as fractions; a crop can
// push it past the slot's edges (lib/content/frame.ts).
const Frame = z.object({
  x: z.number().min(-4).max(1),
  y: z.number().min(-4).max(1),
  w: z.number().gt(0).max(5),
  h: z.number().gt(0).max(5),
})
const isVisible = z.boolean()

export const COLLECTION_SCHEMAS = {
  // Title before slug: the form fills the slug in from the title.
  services: z.object({
    title: text(60),
    slug: Slug,
    body: text(400),
    icon: IconField,
    // pagePath is not here: the service's detail page sets it
    // (server/modules/service-pages), so the form never edits it.
    isVisible,
  }),
  plans: z.object({
    name: text(40),
    slug: Slug,
    priceLabel: text(20),
    priceCents: z.number().int().min(0).max(10_000_000).nullable(),
    unit: text(40),
    summary: text(300),
    features: z.array(text(120)).max(8),
    ctaLabel: text(30),
    featured: z.boolean(),
    isVisible,
  }),
  testimonials: z.object({
    quote: text(600),
    authorName: text(60),
    authorRole: text(80),
    // A Google reviewer often has no photo; the card shows initials.
    avatar: MediaRef.nullable().default(null),
    source: z.enum(["site", "google"]).default("site"),
    rating: z.number().int().min(1).max(5).default(5),
    reviewUrl: z.union([z.literal(""), HttpsUrl]).default(""),
    isVisible,
  }),
  faqs: z.object({ question: text(200), answer: text(1500), isVisible }),
  steps: z.object({
    title: text(60),
    description: text(300),
    image: MediaRef,
    frame: Frame,
    isVisible,
  }),
  "cta-bands": z.object({
    name: text(60),
    eyebrow: text(40),
    title: text(160),
    bullets: z.array(text(120)).min(1).max(6),
    cta: LinkValue,
    image: MediaRef,
    tint: Tint,
    isVisible,
  }),
} as const

export const COLLECTION_LABELS: Record<CollectionSlug, string> = {
  services: "Services",
  plans: "Plans",
  testimonials: "Testimonials",
  faqs: "FAQs",
  steps: "Steps",
  "cta-bands": "CTA bands",
}

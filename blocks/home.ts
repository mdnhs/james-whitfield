// blocks/home.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import {
  IconField,
  LinkValue,
  MediaRef,
  Selection,
  Stat,
  StatValue,
  Tint,
  Variant,
  optionalText,
  text,
} from "./fields"

export const heroHome = defineBlock({
  type: "hero.home",
  label: "Home hero",
  icon: "Sparkles",
  schema: z.object({
    eyebrow: text(40),
    headline: z.object({ lead: text(40), muted: text(60), tail: text(80) }),
    description: text(240),
    primaryCta: LinkValue,
    secondaryCta: LinkValue,
    members: z.object({
      count: StatValue,
      label: text(30),
      avatars: z.array(MediaRef).length(3),
    }),
  }),
  // The WebGL background is bound to its depth and hair maps (D13): only the
  // copy is editable.
  allowedOn: ["home"],
  first: true,
  max: 1,
  uses: ["media"],
})

export const credibility = defineBlock({
  type: "credibility",
  label: "Credibility badges",
  icon: "BadgeCheck",
  schema: z.object({
    badges: z
      .array(z.object({ title: text(40), subtitle: text(40), icon: IconField }))
      .min(3)
      .max(5),
  }),
  allowedOn: "*",
  uses: [],
})

export const aboutIntro = defineBlock({
  type: "about.intro",
  label: "About intro",
  icon: "UserRound",
  schema: z.object({
    eyebrow: text(40),
    headline: text(120),
    quote: text(160),
    paragraphs: z.array(text(600)).min(1).max(3),
    stats: z.array(Stat).min(2).max(4),
    cta: LinkValue,
  }),
  allowedOn: "*",
  uses: [],
})

// Not `process`: that would shadow Node's global in every importer.
export const processBlock = defineBlock({
  type: "process",
  label: "Process steps",
  icon: "Footprints",
  schema: z.object({
    variant: Variant,
    // Pill above the heading; shown on the "page" variant only.
    tag: optionalText(30),
    title: text(60),
    subtitle: text(240),
    cta: LinkValue,
  }),
  allowedOn: "*",
  // One StepsStory pin per page.
  max: 1,
  uses: ["collection:steps", "media"],
})

export const testimonials = defineBlock({
  type: "testimonials",
  label: "Testimonials",
  icon: "Quote",
  schema: z.object({
    variant: Variant,
    eyebrow: text(40),
    title: text(80),
    selection: Selection,
  }),
  allowedOn: "*",
  uses: ["collection:testimonials", "media"],
})

export const band = defineBlock({
  type: "band",
  label: "Call-to-action band",
  icon: "Megaphone",
  schema: z.object({ bandId: z.uuid(), tint: Tint.nullable() }),
  allowedOn: "*",
  uses: ["collection:bands", "media"],
})

export const insightsLatest = defineBlock({
  type: "insights.latest",
  label: "Latest insights",
  icon: "Newspaper",
  schema: z.object({
    title: text(60),
    subtitle: text(200),
    cta: LinkValue,
    count: z.number().int().min(1).max(6),
    // "all" shows the newest; "chosen" shows those articles in that order.
    selection: Selection,
  }),
  allowedOn: "*",
  uses: ["articles", "categories", "authors", "media"],
})

export const faq = defineBlock({
  type: "faq",
  label: "FAQ",
  icon: "CircleHelp",
  schema: z.object({
    variant: Variant,
    title: text(80),
    subtitle: text(200),
    selection: Selection,
    // Index of the item open on load; null starts all closed.
    initiallyOpen: z.number().int().min(0).max(23).nullable(),
  }),
  allowedOn: "*",
  uses: ["collection:faqs"],
})

// blocks/service.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import { IconField, text } from "./fields"

// The sections only a service detail page (/services/<slug>) carries. Their
// lists are inline: each service writes its own, unshared with other pages.

export const serviceIntro = defineBlock({
  type: "service.intro",
  label: "What it is & who it's for",
  icon: "ListChecks",
  schema: z.object({
    eyebrow: text(40),
    title: text(80),
    // Plain text; a blank line starts a new paragraph.
    body: text(1200),
    forYouHeading: text(60),
    forYou: z.array(text(120)).min(2).max(6),
  }),
  allowedOn: ["custom"],
  max: 1,
  uses: [],
})

export const serviceBenefits = defineBlock({
  type: "service.benefits",
  label: "Benefits",
  icon: "Gem",
  schema: z.object({
    eyebrow: text(40),
    title: text(80),
    items: z
      .array(z.object({ icon: IconField, title: text(60), body: text(200) }))
      .min(3)
      .max(6),
  }),
  allowedOn: ["custom"],
  max: 1,
  uses: [],
})

export const serviceFormats = defineBlock({
  type: "service.formats",
  label: "Formats & investment (this service)",
  icon: "Wallet",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(200),
    featuredTag: text(24),
    plans: z
      .array(
        z.object({
          name: text(40),
          priceLabel: text(24),
          unit: text(24),
          summary: text(200),
          features: z.array(text(80)).max(6),
          ctaLabel: text(30),
          featured: z.boolean(),
        })
      )
      .min(1)
      .max(4),
  }),
  allowedOn: ["custom"],
  max: 1,
  uses: [],
})

export const serviceFaq = defineBlock({
  type: "service.faq",
  label: "FAQ (this service)",
  icon: "MessageCircleQuestionMark",
  schema: z.object({
    title: text(80),
    subtitle: text(200),
    items: z
      .array(z.object({ question: text(200), answer: text(1500) }))
      .min(1)
      .max(12),
    // Index of the item open on load; null starts all closed.
    initiallyOpen: z.number().int().min(0).nullable(),
  }),
  allowedOn: ["custom"],
  max: 1,
  uses: [],
})

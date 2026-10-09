// blocks/about.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import {
  Focal,
  Href,
  IconField,
  LinkValue,
  MediaRef,
  Stat,
  text,
} from "./fields"

export const heroPage = defineBlock({
  type: "hero.page",
  label: "Page hero",
  icon: "PanelTop",
  schema: z.object({
    title: text(40),
    subtitle: text(200),
    image: MediaRef,
    // Per-page crop; null uses the image's own focal point.
    focal: Focal.nullable(),
    tint: z.number().min(0).max(0.9),
    mirror: z.boolean(),
  }),
  allowedOn: "*",
  first: true,
  max: 1,
  uses: ["media", "settings:microcopy"],
})

export const aboutStory = defineBlock({
  type: "about.story",
  label: "Story",
  icon: "BookOpen",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    paragraphs: z.array(text(600)).min(1).max(4),
    quote: text(240),
    badge: Stat,
    role: text(60),
    photo: MediaRef,
  }),
  allowedOn: "*",
  uses: ["media", "settings:site"],
})

export const aboutStats = defineBlock({
  type: "about.stats",
  label: "Stats band",
  icon: "ChartNoAxesColumn",
  schema: z.object({ stats: z.array(Stat).min(3).max(4) }),
  allowedOn: "*",
  uses: [],
})

export const aboutApproach = defineBlock({
  type: "about.approach",
  label: "Approach",
  icon: "Compass",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(240),
    principles: z
      .array(z.object({ icon: IconField, title: text(60), body: text(240) }))
      .length(3),
  }),
  allowedOn: "*",
  uses: [],
})

export const aboutCredentials = defineBlock({
  type: "about.credentials",
  label: "Credentials",
  icon: "GraduationCap",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(240),
    cta: LinkValue,
    items: z
      .array(
        z.object({
          year: z.string().regex(/^\d{4}$/),
          title: text(80),
          issuer: text(80),
          url: Href.nullable(),
        })
      )
      .min(3)
      .max(8),
  }),
  allowedOn: "*",
  uses: [],
})

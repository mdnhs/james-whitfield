// blocks/services.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import { LinkValue, text } from "./fields"

export const servicesGrid = defineBlock({
  type: "services.grid",
  label: "Services grid",
  icon: "LayoutGrid",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    intro: text(400),
    more: LinkValue,
  }),
  allowedOn: ["services"],
  max: 1,
  uses: ["collection:services"],
})

export const servicesPlans = defineBlock({
  type: "services.plans",
  label: "Formats & investment",
  icon: "Tags",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(240),
    featuredTag: text(20),
  }),
  allowedOn: "*",
  max: 1,
  uses: ["collection:plans"],
})

export const sessionTimeline = defineBlock({
  type: "session.timeline",
  label: "Session timeline",
  icon: "Clock",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(240),
    beats: z
      .array(z.object({ time: text(20), title: text(60), body: text(200) }))
      .min(3)
      .max(6),
  }),
  allowedOn: "*",
  uses: [],
})

const FitList = z.object({
  heading: text(60),
  items: z.array(text(100)).min(2).max(6),
})

export const fit = defineBlock({
  type: "fit",
  label: "Honest fit",
  icon: "Scale",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(240),
    good: FitList,
    poor: FitList,
  }),
  allowedOn: "*",
  uses: [],
})

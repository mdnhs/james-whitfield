// blocks/insights.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import { optionalText, text } from "./fields"

export const insightsBrowser = defineBlock({
  type: "insights.browser",
  label: "Insights browser",
  icon: "LibraryBig",
  schema: z.object({
    heading: text(60),
    pageSize: z.number().int().min(3).max(12),
  }),
  allowedOn: ["insights"],
  max: 1,
  uses: ["articles", "categories", "authors", "media", "settings:microcopy"],
})

export const newsletter = defineBlock({
  type: "newsletter",
  label: "Newsletter band",
  icon: "Mail",
  schema: z.object({
    // Empty fields fall back to the newsletter global.
    override: z
      .object({
        eyebrow: optionalText(40),
        title: optionalText(120),
        subtitle: optionalText(240),
      })
      .nullable(),
  }),
  allowedOn: "*",
  uses: ["settings:newsletter", "media"],
})

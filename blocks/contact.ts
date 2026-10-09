// blocks/contact.ts
import * as z from "zod"

import { defineBlock } from "./define-block"
import { MediaRef, text } from "./fields"

export const contactDetails = defineBlock({
  type: "contact.details",
  label: "Contact details & form",
  icon: "MessageSquareText",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(300),
  }),
  allowedOn: ["contact"],
  max: 1,
  uses: [
    "settings:contact",
    "settings:contactForm",
    "settings:microcopy",
    "collection:services",
    "collection:plans",
  ],
})

export const contactClinic = defineBlock({
  type: "contact.clinic",
  label: "Clinic",
  icon: "MapPin",
  schema: z.object({
    eyebrow: text(40),
    title: text(120),
    subtitle: text(300),
    photo: MediaRef,
  }),
  allowedOn: "*",
  uses: ["settings:contact", "settings:microcopy", "media"],
})

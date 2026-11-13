import type { FieldOverrides } from "@/admin/components/schema-form/to-fields"
import type { CollectionSlug } from "@/lib/content/collections"

const visible = {
  isVisible: {
    label: "Visible on the site",
    description: "Hidden rows stay here but leave every page.",
  },
}

export const COLLECTION_FIELD_UI: Record<CollectionSlug, FieldOverrides> = {
  services: {
    ...visible,
    slug: {
      description:
        "Fills in from the title; edit it if you like. It is the details page address (/services/<slug>) and the contact link topic.",
    },
  },
  plans: {
    ...visible,
    priceCents: {
      label: "Price in cents",
      description: "For search engines only; the label is what visitors see.",
    },
  },
  testimonials: { ...visible, avatar: { label: "Photo" } },
  faqs: { ...visible, answer: { widget: "textarea" } },
  steps: { ...visible, frame: { widget: "frame", label: "Image crop" } },
  "cta-bands": { ...visible, cta: { label: "Button" } },
}

export const ITEM_NOUN: Record<CollectionSlug, string> = {
  services: "service",
  plans: "plan",
  testimonials: "testimonial",
  faqs: "FAQ",
  steps: "step",
  "cta-bands": "band",
}

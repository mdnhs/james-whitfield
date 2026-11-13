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
        "Made from the title; edit it if you like. The service's page lives at /services/<slug> and its card's link goes there. Changing it moves the page; the old address redirects.",
      warning: true,
    },
  },
  plans: {
    ...visible,
    priceCents: {
      label: "Price in cents",
      description: "For search engines only; the label is what visitors see.",
    },
  },
  testimonials: {
    ...visible,
    avatar: { label: "Photo" },
    source: {
      label: "Source",
      options: [
        { value: "site", label: "Website testimonial" },
        { value: "google", label: "Google review" },
      ],
    },
    rating: {
      label: "Stars",
      description: "Shown on the card for Google reviews.",
    },
    reviewUrl: { label: "Link to the review on Google" },
  },
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

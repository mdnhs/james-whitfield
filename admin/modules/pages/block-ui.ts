import type { FieldOverrides } from "@/admin/components/schema-form/to-fields"
import type { BlockType } from "@/blocks/registry"

// Per-block hints the shared field widgets (field-ui.ts) cannot know: which
// collection a picker reads, and labels that explain an optional override.
export const BLOCK_FIELD_UI: Partial<Record<BlockType, FieldOverrides>> = {
  testimonials: {
    selection: {
      widget: "collection",
      collection: "testimonials",
      label: "Testimonials to show",
    },
    show: {
      label: "Show",
      options: [
        { value: "all", label: "All" },
        { value: "site", label: "Website testimonials only" },
        { value: "google", label: "Google reviews only" },
      ],
    },
    "google.rating": {
      label: "Google rating",
      description: "e.g. 4.9. Leave empty to hide the Google summary.",
      step: 0.1,
    },
    "google.count": { label: "Number of Google reviews" },
    "google.profileUrl": {
      label: "Google profile link",
      description: 'Powers the "See all on Google" button.',
    },
    "google.writeUrl": {
      label: "Write-a-review link",
      description: 'Powers the "Write a review" button.',
    },
  },
  faq: {
    selection: {
      widget: "collection",
      collection: "faqs",
      label: "Questions to show",
    },
    initiallyOpen: {
      label: "Open on load",
      description:
        "Position of the question to open (0 = first); empty keeps all closed.",
    },
  },
  "insights.latest": {
    selection: {
      widget: "collection",
      collection: "articles",
      label: "Articles to show",
    },
  },
  band: {
    bandId: { widget: "collection", collection: "cta-bands", label: "Band" },
    tint: {
      label: "Tint override",
      description: "Leave empty to use the band's own tint.",
    },
  },
  "hero.page": {
    tint: { step: 0.01 },
    focal: { label: "Focal point override" },
    cta: { label: "Button", description: "Leave empty for no button." },
  },
  "service.intro": {
    body: { label: "Description" },
    forYouHeading: { label: "List heading" },
    forYou: { label: "This is for you if" },
  },
  "service.faq": {
    initiallyOpen: {
      label: "Open on load",
      description:
        "Position of the question to open (0 = first); empty keeps all closed.",
    },
  },
  newsletter: { override: { label: "Custom copy for this page" } },
  richtext: { doc: { label: "Text" } },
}

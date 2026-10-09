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
  },
  newsletter: { override: { label: "Custom copy for this page" } },
}

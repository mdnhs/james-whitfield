import * as z from "zod"

import { ui } from "@/admin/components/schema-form/registry"
import { MediaRef } from "@/blocks/fields"
import { TWITTER_CARDS, type SeoPatch } from "@/blocks/page"

// Max lengths mirror SeoPatch (70/200/70/200/300), so the form's live
// counters match what the server accepts.
export const SeoMetaFields = {
  seoTitle: z.string().trim().max(70).register(ui, { label: "SEO title" }),
  description: z
    .string()
    .trim()
    .max(200)
    .register(ui, { label: "Meta description", widget: "textarea" }),
  ogTitle: z.string().trim().max(70).register(ui, { label: "Social title" }),
  ogDescription: z
    .string()
    .trim()
    .max(200)
    .register(ui, { label: "Social description", widget: "textarea" }),
  ogImage: MediaRef.nullable().register(ui, { label: "Social share image" }),
  canonical: z.string().trim().max(300).register(ui, {
    label: "Canonical address",
    description: "Leave empty to use this page's own address.",
  }),
  twitterCard: z.enum(TWITTER_CARDS).register(ui, {
    label: "Card type",
    options: [
      { value: "summary_large_image", label: "Large image" },
      { value: "summary", label: "Small image" },
    ],
  }),
  noindex: z.boolean().register(ui, { label: "Hide from search engines" }),
}

export const SeoMetaForm = z.object(SeoMetaFields)
export type SeoMetaValues = z.input<typeof SeoMetaForm>

const blank = (v: string) => v || null

export function toSeoPatch(v: SeoMetaValues): SeoPatch {
  return {
    title: blank(v.seoTitle),
    description: blank(v.description),
    ogTitle: blank(v.ogTitle),
    ogDescription: blank(v.ogDescription),
    ogImage: v.ogImage,
    canonical: blank(v.canonical),
    twitterCard: v.twitterCard,
    noindex: v.noindex,
  }
}

export function seoMetaDefaults(seo: SeoPatch): SeoMetaValues {
  return {
    seoTitle: seo.title ?? "",
    description: seo.description ?? "",
    ogTitle: seo.ogTitle ?? "",
    ogDescription: seo.ogDescription ?? "",
    ogImage: seo.ogImage ?? null,
    canonical: seo.canonical ?? "",
    twitterCard: seo.twitterCard ?? "summary_large_image",
    noindex: seo.noindex ?? false,
  }
}

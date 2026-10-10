// lib/content/types.ts
// What the content repo hands to sections. Shared by server and client code;
// it holds no values, only shapes.
import type { Resolve } from "@/blocks/media-refs"
import type { PageDocument, PageSeo, PageSettings } from "@/blocks/page"
import type { ArticleBodyDoc } from "@/blocks/rich-text"
import type { IconName } from "@/lib/icons"
import type { MediaAsset } from "@/lib/media"

import type { GlobalKey, GlobalValue } from "./globals"

export type GlobalView<K extends GlobalKey> = Resolve<GlobalValue<K>>

export type ServiceView = {
  id: string
  slug: string
  title: string
  body: string
  icon: IconName
}

export type PlanView = {
  id: string
  slug: string
  name: string
  priceLabel: string
  unit: string
  summary: string
  features: string[]
  ctaLabel: string
  featured: boolean
}

export type TestimonialView = {
  id: string
  quote: string
  name: string
  role: string
  avatar: MediaAsset
}

export type FaqView = { id: string; question: string; answer: string }

// Crop rectangle of a step photo inside its media slot, as fractions.
export type StepFrame = { x: number; y: number; w: number; h: number }

export type ProcessStepView = {
  id: string
  title: string
  description: string
  image: MediaAsset
  frame: StepFrame
}

export type CtaBandView = {
  id: string
  eyebrow: string
  title: string
  bullets: string[]
  cta: { label: string; href: string }
  image: MediaAsset
  tint: number
}

export type CategoryView = { id: string; slug: string; name: string }

export type ArticleSummary = {
  id: string
  slug: string
  title: string
  excerpt: string
  image: MediaAsset
  category: { slug: string; name: string }
  author: { name: string; avatar: MediaAsset | null }
  date: { iso: string; label: string }
  readingMinutes: number
  featured: boolean
}

export type ArticleDetail = ArticleSummary & {
  body: ArticleBodyDoc
  // Assets of the body's images, for RichText.
  media: MediaAsset[]
  // Service slug for the closing CTA's ?topic= (category → related service).
  topicSlug: string | null
}

export type ContactOption = { slug: string; label: string }
export type PlanOption = {
  slug: string
  name: string
  priceLabel: string
  unit: string
}

export type PublishedPage = {
  id: string
  path: string
  title: string
  systemKey: string | null
  document: PageDocument
  seo: PageSeo
  settings: PageSettings
}

export type Chapter = { label: string; target: string }

import "server-only"

import { RichTextDoc } from "@/blocks/rich-text"
import { ABOUT_CTA } from "@/features/about-page/data/about-page-content"
import { ENTERPRISE_CONTENT } from "@/features/enterprise/data/enterprise-content"
import { FAQS } from "@/features/faq/data/faqs"
import { STEPS } from "@/features/how-it-works/data/steps"
import { ARTICLE_BODIES } from "@/features/insights/data/article-bodies"
import {
  ALL_ARTICLES,
  CATEGORIES,
  FEATURED_ARTICLE,
} from "@/features/insights/data/articles"
import { FORMATS, SERVICES } from "@/features/services/data/services-content"
import { TESTIMONIALS } from "@/features/testimonials/data/testimonials"
import { cropToFrame } from "@/lib/content/frame"
import { slugify } from "@/lib/utils"
import type { Db } from "@/server/db/client"
import * as t from "@/server/db/schema"

import { seedId } from "./ids"
import { mediaRef } from "./media"
import { plainText, readingMinutes, toTipTap } from "./tiptap"

export const BAND_IDS = {
  enterprise: seedId("band", "enterprise"),
  about: seedId("band", "next-step"),
}

// The article CTA's ?topic= used to come from TOPIC_FOR; it is now the
// category's related service.
const RELATED_SERVICE: Record<string, string> = {
  "Anxiety & Stress": "anxiety-stress",
  Leadership: "performance-leadership",
  Sleep: "sleep-rest",
}

const cents = (label: string) =>
  label === "Free" ? 0 : Number(label.replace(/[^\d]/g, "")) * 100
const media = (url: string) => mediaRef(url).mediaId

export async function seedCollections(db: Db) {
  await db
    .insert(t.services)
    .values(
      SERVICES.items.map((s, i) => ({
        id: seedId("service", slugify(s.title)),
        slug: slugify(s.title),
        title: s.title,
        body: s.body,
        icon: s.icon,
        sort: i,
      }))
    )
    .onConflictDoNothing()

  await db
    .insert(t.plans)
    .values(
      FORMATS.plans.map((p, i) => ({
        id: seedId("plan", slugify(p.name)),
        slug: slugify(p.name),
        name: p.name,
        priceLabel: p.price,
        priceCents: cents(p.price),
        unit: p.unit,
        summary: p.summary,
        features: p.features,
        ctaLabel: p.cta.label,
        featured: p.featured ?? false,
        sort: i,
      }))
    )
    .onConflictDoNothing()

  // Left column first, then right: splitColumns gives back today's columns.
  await db
    .insert(t.testimonials)
    .values(
      TESTIMONIALS.map((x, i) => ({
        id: seedId("testimonial", String(i)),
        quote: x.quote,
        authorName: x.name,
        authorRole: x.role,
        avatarId: media(x.avatar),
        sort: i,
      }))
    )
    .onConflictDoNothing()

  await db
    .insert(t.faqs)
    .values(
      FAQS.map((f, i) => ({
        id: seedId("faq", String(i)),
        question: f.question,
        answer: f.answer,
        sort: i,
      }))
    )
    .onConflictDoNothing()

  await db
    .insert(t.processSteps)
    .values(
      STEPS.map((s, i) => ({
        id: seedId("step", String(i)),
        title: s.title,
        description: s.description,
        imageId: media(s.image),
        frame: cropToFrame(s.crop),
        sort: i,
      }))
    )
    .onConflictDoNothing()

  await db
    .insert(t.ctaBands)
    .values(
      [
        {
          id: BAND_IDS.enterprise,
          name: "Enterprise",
          band: ENTERPRISE_CONTENT,
        },
        { id: BAND_IDS.about, name: "Next step", band: ABOUT_CTA },
      ].map(({ id, name, band }, i) => ({
        id,
        name,
        eyebrow: band.eyebrow,
        title: band.title,
        bullets: [...band.bullets],
        cta: band.cta,
        imageId: media(band.image),
        tint: band.tint,
        sort: i,
      }))
    )
    .onConflictDoNothing()

  await db
    .insert(t.articleCategories)
    .values(
      CATEGORIES.map((name, i) => ({
        id: seedId("category", slugify(name)),
        slug: slugify(name),
        name,
        relatedServiceId: RELATED_SERVICE[name]
          ? seedId("service", RELATED_SERVICE[name])
          : null,
        sort: i,
      }))
    )
    .onConflictDoNothing()

  // The fixtures sign the same person with four avatars; each pairing is
  // its own author row so every byline renders as before (a content finding
  // for the client).
  const authors = new Map<string, { name: string; avatar: string }>()
  for (const a of ALL_ARTICLES)
    authors.set(`${a.author.name}|${a.author.avatar}`, a.author)
  const authorId = (a: { name: string; avatar: string }) =>
    seedId("author", `${a.name}|${a.avatar}`)
  await db
    .insert(t.authors)
    .values(
      [...authors.values()].map((a, i) => ({
        id: authorId(a),
        slug: slugify(
          `${a.name} ${a.avatar
            .split("/")
            .pop()!
            .replace(/\.\w+$/, "")}`
        ),
        name: a.name,
        avatarId: media(a.avatar),
        sort: i,
      }))
    )
    .onConflictDoNothing()

  await db
    .insert(t.articles)
    .values(
      ALL_ARTICLES.map((a) => {
        const body = RichTextDoc.parse(toTipTap(ARTICLE_BODIES[a.slug] ?? []))
        const text = plainText(body)
        return {
          id: seedId("article", a.slug),
          slug: a.slug,
          title: a.title,
          excerpt: a.excerpt,
          coverId: media(a.image),
          categoryId: seedId("category", slugify(a.category)),
          authorId: authorId(a.author),
          body,
          bodyText: text,
          readingMinutes: readingMinutes(text),
          featured: a.slug === FEATURED_ARTICLE.slug,
          status: "published" as const,
          // Midday UTC is the same calendar day in Dublin all year.
          publishedAt: new Date(`${a.date.iso}T12:00:00Z`),
        }
      })
    )
    .onConflictDoNothing()
}

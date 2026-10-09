import { sql, type SQL } from "drizzle-orm"
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import type { RichTextDoc } from "@/blocks/rich-text"
import type { StepFrame } from "@/lib/content/types"

import { users } from "./auth"
import { media } from "./media"

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
})

// Fresh builders per table: Drizzle column builders must not be shared.
const stamps = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  updatedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  version: integer().notNull().default(1),
})

// Shared by every collection row (docs/brief.md §6.3). Saving goes live;
// is_visible is the soft unpublish.
const row = () => ({
  id: uuid().primaryKey().defaultRandom(),
  sort: integer().notNull().default(0),
  isVisible: boolean().notNull().default(true),
  ...stamps(),
})

// Media in use cannot be deleted (the Phase 4 delete guard relies on it).
const image = () =>
  uuid()
    .notNull()
    .references(() => media.id, { onDelete: "restrict" })

export const services = pgTable("services", {
  ...row(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  body: text().notNull(),
  icon: text().notNull(),
})

export const plans = pgTable("plans", {
  ...row(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  priceLabel: text().notNull(),
  // For JSON-LD offers (Phase 7); the label is what the site prints.
  priceCents: integer(),
  unit: text().notNull(),
  summary: text().notNull(),
  features: jsonb().$type<string[]>().notNull().default([]),
  ctaLabel: text().notNull(),
  featured: boolean().notNull().default(false),
})

export const testimonials = pgTable("testimonials", {
  ...row(),
  quote: text().notNull(),
  authorName: text().notNull(),
  authorRole: text().notNull(),
  avatarId: image(),
})

export const faqs = pgTable("faqs", {
  ...row(),
  question: text().notNull(),
  answer: text().notNull(),
})

export const processSteps = pgTable("process_steps", {
  ...row(),
  title: text().notNull(),
  description: text().notNull(),
  imageId: image(),
  frame: jsonb().$type<StepFrame>().notNull(),
})

export const ctaBands = pgTable("cta_bands", {
  ...row(),
  name: text().notNull(),
  eyebrow: text().notNull(),
  title: text().notNull(),
  bullets: jsonb().$type<string[]>().notNull().default([]),
  cta: jsonb().$type<{ label: string; href: string }>().notNull(),
  imageId: image(),
  tint: real().notNull().default(0.9),
})

export const articleCategories = pgTable("article_categories", {
  ...row(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  description: text().notNull().default(""),
  // Replaces TOPIC_FOR: the article CTA pre-fills this service.
  relatedServiceId: uuid().references(() => services.id, {
    onDelete: "set null",
  }),
})

export const authors = pgTable("authors", {
  ...row(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  roleTitle: text().notNull().default(""),
  bio: text().notNull().default(""),
  avatarId: image(),
  userId: uuid().references(() => users.id, { onDelete: "set null" }),
})

export const articles = pgTable(
  "articles",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    excerpt: text().notNull(),
    coverId: image(),
    categoryId: uuid()
      .notNull()
      .references(() => articleCategories.id, { onDelete: "restrict" }),
    authorId: uuid()
      .notNull()
      .references(() => authors.id, { onDelete: "restrict" }),
    // Published copy in typed columns (what the site reads and searches);
    // the editor's working copy lives in `draft` (docs/brief.md §6.5).
    body: jsonb().$type<RichTextDoc>().notNull(),
    bodyText: text().notNull().default(""),
    readingMinutes: integer().notNull().default(1),
    featured: boolean().notNull().default(false),
    status: text({ enum: ["draft", "scheduled", "published", "archived"] })
      .notNull()
      .default("draft"),
    publishedAt: timestamp({ withTimezone: true }),
    scheduledFor: timestamp({ withTimezone: true }),
    draft: jsonb().$type<unknown>(),
    seo: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ...stamps(),
    // Unqualified column names: Postgres generated columns may only use
    // their own row, and a qualified reference adds nothing.
    search: tsvector().generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') || setweight(to_tsvector('english', coalesce(body_text, '')), 'C')`
    ),
  },
  (table) => [
    index("articles_search_idx").using("gin", table.search),
    index("articles_status_published_idx").on(
      table.status,
      table.publishedAt.desc()
    ),
  ]
)

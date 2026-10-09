import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import type { PageDocument, PageSeo, PageSettings } from "@/blocks/page"

import { users } from "./auth"

// A URL whose document is an ordered list of blocks (docs/brief.md §6.1).
// `draft` is always the working copy; `published` is what the site serves.
export const pages = pgTable("pages", {
  id: uuid().primaryKey().defaultRandom(),
  // Fixed keys for system pages (cannot be deleted); null for custom pages.
  systemKey: text().unique(),
  path: text().notNull().unique(),
  title: text().notNull(),
  status: text({ enum: ["draft", "published"] })
    .notNull()
    .default("draft"),
  draft: jsonb().$type<PageDocument>().notNull(),
  published: jsonb().$type<PageDocument>(),
  seo: jsonb().$type<Partial<PageSeo>>().notNull().default({}),
  settings: jsonb().$type<Partial<PageSettings>>().notNull().default({}),
  version: integer().notNull().default(1),
  publishedAt: timestamp({ withTimezone: true }),
  publishedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  updatedBy: uuid().references(() => users.id, { onDelete: "set null" }),
})

// Publish snapshots (last 50 per entity, Phase 4) and global rollbacks.
export const revisions = pgTable(
  "revisions",
  {
    id: uuid().primaryKey().defaultRandom(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    version: integer().notNull(),
    snapshot: jsonb().$type<unknown>().notNull(),
    note: text(),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("revisions_entity_idx").on(
      table.entityType,
      table.entityId,
      table.createdAt.desc()
    ),
  ]
)

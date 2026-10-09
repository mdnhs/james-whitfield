import {
  boolean,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { users } from "./auth"

// Every image the site shows (docs/brief.md §6.6, §14). `static` rows point at
// public/images (seeded); uploads arrive in Phase 4.
export const media = pgTable("media", {
  id: uuid().primaryKey().defaultRandom(),
  driver: text({ enum: ["static", "local", "s3"] }).notNull(),
  // Content-hashed for uploads; the public path for static assets.
  key: text().notNull().unique(),
  url: text().notNull(),
  filename: text().notNull(),
  mimeType: text().notNull(),
  sizeBytes: integer().notNull(),
  width: integer(),
  height: integer(),
  blurDataUrl: text(),
  dominantColor: text(),
  alt: text().notNull().default(""),
  caption: text(),
  focalX: real().notNull().default(0.5),
  focalY: real().notNull().default(0.5),
  isDecorative: boolean().notNull().default(false),
  // Seeded assets whose alt text was not obvious from context.
  needsAlt: boolean().notNull().default(false),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  deletedAt: timestamp({ withTimezone: true }),
})

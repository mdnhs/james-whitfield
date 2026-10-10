import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import type { ConsentRecord } from "@/lib/leads/schema"

import { users } from "./auth"

// docs/brief.md §6.6. Enquiries may reveal health information (§15): only
// owner, admin and intake read them, and audit rows never copy their fields.
export const leads = pgTable(
  "leads",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    email: text().notNull(),
    phone: text(),
    topicSlug: text().notNull().default(""),
    formatSlug: text(),
    planSlug: text(),
    message: text().notNull().default(""),
    privacyConsentAt: timestamp({ withTimezone: true }),
    marketingConsent: boolean().notNull().default(false),
    consent: jsonb().$type<ConsentRecord>().notNull().default({}),
    status: text().notNull().default("new"),
    statusChangedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    spamReason: text(),
    assignedTo: uuid().references(() => users.id, { onDelete: "set null" }),
    sourcePath: text().notNull().default("/"),
    referrer: text().notNull().default(""),
    utm: jsonb().$type<Record<string, string>>().notNull().default({}),
    ipHash: text(),
    userAgent: text().notNull().default(""),
    metaEventId: text(),
    // R17: Turnstile siteverify was unreachable, so the lead went in unchecked.
    turnstileUnverified: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      "leads_status_check",
      sql`${t.status} in ('new','contacted','booked','closed','spam')`
    ),
    index("leads_status_created_idx").on(t.status, t.createdAt.desc()),
    index("leads_email_idx").on(sql`lower(${t.email})`),
    index("leads_status_changed_idx").on(t.status, t.statusChangedAt),
  ]
)

export const leadActivities = pgTable(
  "lead_activities",
  {
    id: uuid().primaryKey().defaultRandom(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    type: text().notNull(),
    body: text().notNull().default(""),
    data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "lead_activities_type_check",
      sql`${t.type} in ('note','status','email','assignment')`
    ),
    index("lead_activities_lead_idx").on(t.leadId, t.createdAt),
  ]
)

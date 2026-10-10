import { sql } from "drizzle-orm"
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { users } from "./auth"

// docs/superpowers/specs/2026-10-11-ai-assistant-design.md §6. Deleting a
// user deletes their conversations (GDPR); retention purges stale ones.
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text().notNull(),
    model: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_conversations_user_updated_idx").on(t.userId, t.updatedAt.desc()),
    index("ai_conversations_updated_idx").on(t.updatedAt),
  ]
)

// `parts` holds AI SDK UI message parts, reduced before saving (Ruling R9).
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text().notNull(),
    parts: jsonb().$type<unknown[]>().notNull(),
    tokensIn: integer(),
    tokensOut: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("ai_messages_role_check", sql`${t.role} in ('user','assistant')`),
    index("ai_messages_conversation_idx").on(t.conversationId, t.createdAt),
  ]
)

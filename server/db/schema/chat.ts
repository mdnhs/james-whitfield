import { sql } from "drizzle-orm"
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { users } from "./auth"

// docs/superpowers live-chat plan. Visitors are anonymous: they hold only the
// raw token (cookie); the hash is stored. Messages may reveal health details,
// so retention (privacy.chatRetentionMonths) purges whole conversations.
export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    tokenHash: text().notNull().unique(),
    status: text().notNull().default("open"),
    aiEnabled: boolean().notNull().default(true),
    needsHuman: boolean().notNull().default(false),
    assignedTo: uuid().references(() => users.id, { onDelete: "set null" }),
    visitorName: text().notNull(),
    visitorEmail: text(),
    consentAt: timestamp({ withTimezone: true }).notNull(),
    // Path only, never the query string or hash.
    sourcePath: text(),
    aiReplyCount: integer().notNull().default(0),
    messageCount: integer().notNull().default(0),
    // The bot holds this lease while it answers, so two requests never reply
    // twice (no process-local state).
    aiLeaseUntil: timestamp({ withTimezone: true }),
    lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastVisitorMessageAt: timestamp({ withTimezone: true }),
    // Last reply from staff or the AI.
    lastReplyAt: timestamp({ withTimezone: true }),
    staffReadAt: timestamp({ withTimezone: true }),
    noReplyAlertedAt: timestamp({ withTimezone: true }),
    needsHumanAlertedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    check(
      "chat_conversations_status_check",
      sql`${t.status} in ('open','closed')`
    ),
    check(
      "chat_conversations_source_path_check",
      sql`${t.sourcePath} is null or char_length(${t.sourcePath}) <= 200`
    ),
    index("chat_conversations_status_last_idx").on(
      t.status,
      t.lastMessageAt.desc()
    ),
    index("chat_conversations_email_idx").on(sql`lower(${t.visitorEmail})`),
  ]
)

// `id` is the polling cursor, so it must be monotonic: bigserial.
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    conversationId: uuid()
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    sender: text().notNull(),
    senderName: text(),
    body: text().notNull(),
    // Set on one-off notices (handoff, limit, failed, crisis): the partial
    // unique index below lets each be written at most once per chat.
    noticeKind: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "chat_messages_sender_check",
      sql`${t.sender} in ('visitor','staff','ai','system')`
    ),
    check("chat_messages_body_check", sql`char_length(${t.body}) <= 2000`),
    uniqueIndex("chat_messages_notice_once_idx")
      .on(t.conversationId, t.noticeKind)
      .where(sql`${t.noticeKind} is not null`),
    index("chat_messages_conversation_idx").on(t.conversationId, t.id),
  ]
)

// Which staff member has the inbox open; read to decide "someone is online".
export const chatPresence = pgTable("chat_presence", {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  seenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

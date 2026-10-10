import "server-only"

import { and, desc, eq, gte, isNull, ne, or, sql, type SQL } from "drizzle-orm"

import { hasPermission, type Permissions } from "@/lib/auth/permissions"
import {
  NOTIFICATION_LIMIT,
  NOTIFICATION_WINDOW_DAYS,
  type NotificationItem,
  type NotificationKind,
  type NotificationsDto,
} from "@/lib/notifications"
import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { auditLogs, leadActivities, leads, users } from "@/server/db/schema"

type Draft = Omit<NotificationItem, "unread" | "at"> & { at: Date }

type AuditSource = {
  action: string
  kind: NotificationKind
  title: string
  needs: Permissions
  href: (entityId: string | null) => string
  where?: (actor: Actor) => SQL | undefined
}

const article = (id: string | null) =>
  id ? `/admin/insights/${id}` : "/admin/insights"

const AUDIT_SOURCES: AuditSource[] = [
  {
    action: "article.publish",
    kind: "published",
    title: "Article went live",
    needs: { article: ["read"] },
    href: article,
    // Only the scheduler publishes without an actor.
    where: () => isNull(auditLogs.actorId),
  },
  {
    action: "article.schedule_failed",
    kind: "schedule_failed",
    title: "A scheduled article wasn't published",
    needs: { article: ["update"] },
    href: article,
  },
  {
    action: "article.submit",
    kind: "review_requested",
    title: "Review requested",
    needs: { article: ["publish"] },
    href: article,
    where: (actor) =>
      or(isNull(auditLogs.actorId), ne(auditLogs.actorId, actor.userId)),
  },
  {
    action: "tracking.capi_failed",
    kind: "capi_failed",
    title: "Meta Conversions API failed",
    needs: { tracking: ["read"] },
    href: () => "/admin/marketing",
  },
]

const firstName = (name: string) => name.trim().split(/\s+/)[0] || "someone"

async function leadItems(since: Date): Promise<Draft[]> {
  const rows = await getDb()
    .select({ id: leads.id, name: leads.name, createdAt: leads.createdAt })
    .from(leads)
    .where(and(ne(leads.status, "spam"), gte(leads.createdAt, since)))
    .orderBy(desc(leads.createdAt))
    .limit(NOTIFICATION_LIMIT)
  return rows.map((row) => ({
    id: `lead:${row.id}`,
    kind: "enquiry",
    title: "New enquiry",
    description: `From ${firstName(row.name)}`,
    href: `/admin/leads?lead=${row.id}`,
    at: row.createdAt,
  }))
}

async function deliveryItems(since: Date): Promise<Draft[]> {
  const rows = await getDb()
    .select({
      id: leadActivities.id,
      leadId: leadActivities.leadId,
      kind: sql<string>`${leadActivities.data}->>'kind'`,
      createdAt: leadActivities.createdAt,
    })
    .from(leadActivities)
    .where(
      and(
        eq(leadActivities.type, "email"),
        sql`${leadActivities.data}->>'status' = 'failed'`,
        gte(leadActivities.createdAt, since)
      )
    )
    .orderBy(desc(leadActivities.createdAt))
    .limit(NOTIFICATION_LIMIT)
  return rows.map((row) => ({
    id: `email:${row.id}`,
    kind: "delivery_failed",
    title: "An enquiry email didn't send",
    description:
      row.kind === "auto-reply"
        ? "The auto-reply to the enquirer failed"
        : "The notification to the practice failed",
    href: `/admin/leads?lead=${row.leadId}`,
    at: row.createdAt,
  }))
}

async function auditItems(actor: Actor, since: Date): Promise<Draft[]> {
  const allowed = AUDIT_SOURCES.filter((s) =>
    hasPermission(actor.roles, s.needs)
  )
  if (!allowed.length) return []
  const rows = await getDb()
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityId: auditLogs.entityId,
      summary: auditLogs.summary,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(
      and(
        gte(auditLogs.createdAt, since),
        or(
          ...allowed.map((s) =>
            and(eq(auditLogs.action, s.action), s.where?.(actor))
          )
        )
      )
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(NOTIFICATION_LIMIT)
  return rows.map((row) => {
    const source = allowed.find((s) => s.action === row.action)!
    return {
      id: `audit:${row.id}`,
      kind: source.kind,
      title: source.title,
      description: row.summary,
      href: source.href(row.entityId),
      at: row.createdAt,
    }
  })
}

async function seenAtOf(actor: Actor) {
  const [row] = await getDb()
    .select({ seen: users.notificationsSeenAt, created: users.createdAt })
    .from(users)
    .where(eq(users.id, actor.userId))
  // A new account has seen everything that happened before it existed.
  return row?.seen ?? row?.created ?? new Date(0)
}

export async function listNotifications(
  actor: Actor,
  now: Date = new Date()
): Promise<NotificationsDto> {
  const since = new Date(now.getTime() - NOTIFICATION_WINDOW_DAYS * 86_400_000)
  const canLeads = hasPermission(actor.roles, { lead: ["read"] })
  const [seenAt, ...groups] = await Promise.all([
    seenAtOf(actor),
    canLeads ? leadItems(since) : [],
    canLeads ? deliveryItems(since) : [],
    auditItems(actor, since),
  ])
  const items = groups
    .flat()
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, NOTIFICATION_LIMIT)
    .map((item) => ({
      ...item,
      at: item.at.toISOString(),
      unread: item.at > seenAt,
    }))
  return {
    items,
    unread: items.filter((item) => item.unread).length,
    seenAt: seenAt.toISOString(),
  }
}

// Personal UI state, so not audited (Ruling R6).
export async function markSeen(actor: Actor, now: Date = new Date()) {
  await getDb()
    .update(users)
    .set({ notificationsSeenAt: now })
    .where(eq(users.id, actor.userId))
  return { seenAt: now.toISOString() }
}

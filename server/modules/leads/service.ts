import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  ilike,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm"

import type { LeadListQuery, LeadStatus } from "@/lib/leads/schema"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { leadActivities, leads, users } from "@/server/db/schema"
import { audit } from "@/server/lib/audit"

import { toCsv } from "./csv"

const ASSIGNABLE_ROLES = ["owner", "admin", "intake"]

type Person = { id: string; name: string } | null

export type LeadSummary = {
  id: string
  name: string
  email: string
  phone: string | null
  topicSlug: string
  formatSlug: string | null
  status: string
  spamReason: string | null
  assignee: Person
  createdAt: Date
}

export type LeadActivity = {
  id: string
  type: string
  body: string
  data: Record<string, unknown>
  actor: Person
  createdAt: Date
}

export type LeadDetail = LeadSummary & {
  message: string
  planSlug: string | null
  privacyConsentAt: Date | null
  marketingConsent: boolean
  consent: unknown
  sourcePath: string
  referrer: string
  utm: Record<string, string>
  metaEventId: string | null
  activities: LeadActivity[]
}

const summaryColumns = {
  id: leads.id,
  name: leads.name,
  email: leads.email,
  phone: leads.phone,
  topicSlug: leads.topicSlug,
  formatSlug: leads.formatSlug,
  status: leads.status,
  spamReason: leads.spamReason,
  assigneeId: leads.assignedTo,
  assigneeName: users.name,
  createdAt: leads.createdAt,
}

const person = (id: string | null, name: string | null): Person =>
  id ? { id, name: name ?? "" } : null

function escapeLike(q: string) {
  return q.replace(/[\\%_]/g, (m) => `\\${m}`)
}

function filters(
  actor: Actor | null,
  query: Pick<LeadListQuery, "folder" | "status" | "assignee" | "q">
) {
  const parts: SQL[] = [
    query.folder === "spam"
      ? eq(leads.status, "spam")
      : ne(leads.status, "spam"),
  ]
  if (query.status) parts.push(eq(leads.status, query.status))
  if (query.assignee === "none") parts.push(sql`${leads.assignedTo} is null`)
  else if (query.assignee === "me" && actor)
    parts.push(eq(leads.assignedTo, actor.userId))
  else if (query.assignee && query.assignee !== "me")
    parts.push(eq(leads.assignedTo, query.assignee))
  if (query.q) {
    const like = `%${escapeLike(query.q)}%`
    parts.push(
      or(
        ilike(leads.name, like),
        ilike(leads.email, like),
        ilike(leads.phone, like)
      )!
    )
  }
  return and(...parts)
}

export async function listLeads(actor: Actor, query: LeadListQuery) {
  const db = getDb()
  const where = filters(actor, query)
  const order = query.sort === "createdAt:asc" ? asc : desc
  const [rows, [totalRow]] = await Promise.all([
    db
      .select(summaryColumns)
      .from(leads)
      .leftJoin(users, eq(users.id, leads.assignedTo))
      .where(where)
      .orderBy(order(leads.createdAt), order(leads.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(leads).where(where),
  ])
  return {
    items: rows.map(toSummary),
    page: query.page,
    pageSize: query.pageSize,
    total: totalRow?.total ?? 0,
  }
}

function toSummary({
  assigneeId,
  assigneeName,
  ...row
}: {
  assigneeId: string | null
  assigneeName: string | null
} & Omit<LeadSummary, "assignee">): LeadSummary {
  return { ...row, assignee: person(assigneeId, assigneeName) }
}

export async function leadStats() {
  const [row] = await getDb()
    .select({ n: count() })
    .from(leads)
    .where(eq(leads.status, "new"))
  return { new: row?.n ?? 0 }
}

export async function listAssignees() {
  const rows = await getDb()
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(or(eq(users.banned, false), sql`${users.banned} is null`))
    .orderBy(asc(users.name), asc(users.id))
  const items = rows
    .filter((r) =>
      (r.role ?? "").split(",").some((x) => ASSIGNABLE_ROLES.includes(x))
    )
    .map(({ id, name }) => ({ id, name }))
  return { items }
}

export async function getLeadsDetail(ids: string[]): Promise<LeadDetail[]> {
  if (!ids.length) return []
  const db = getDb()
  const rows = await db
    .select({
      ...summaryColumns,
      message: leads.message,
      planSlug: leads.planSlug,
      privacyConsentAt: leads.privacyConsentAt,
      marketingConsent: leads.marketingConsent,
      consent: leads.consent,
      sourcePath: leads.sourcePath,
      referrer: leads.referrer,
      utm: leads.utm,
      metaEventId: leads.metaEventId,
    })
    .from(leads)
    .leftJoin(users, eq(users.id, leads.assignedTo))
    .where(inArray(leads.id, ids))
    .orderBy(asc(leads.createdAt), asc(leads.id))
  const acts = await db
    .select({
      id: leadActivities.id,
      leadId: leadActivities.leadId,
      type: leadActivities.type,
      body: leadActivities.body,
      data: leadActivities.data,
      actorId: leadActivities.actorId,
      actorName: users.name,
      createdAt: leadActivities.createdAt,
    })
    .from(leadActivities)
    .leftJoin(users, eq(users.id, leadActivities.actorId))
    .where(inArray(leadActivities.leadId, ids))
    .orderBy(asc(leadActivities.createdAt), asc(leadActivities.id))
  return rows.map((row) => {
    const { assigneeId, assigneeName, ...rest } = row
    return {
      ...rest,
      assignee: person(assigneeId, assigneeName),
      activities: acts
        .filter((a) => a.leadId === row.id)
        .map((a) => ({
          id: a.id,
          type: a.type,
          body: a.body,
          data: a.data,
          actor: person(a.actorId, a.actorName),
          createdAt: a.createdAt,
        })),
    }
  })
}

export async function getLead(id: string) {
  const [lead] = await getLeadsDetail([id])
  if (!lead) throw new ApiError("NOT_FOUND", "Enquiry not found")
  return lead
}

export async function updateLead(
  actor: Actor,
  id: string,
  patch: { status?: LeadStatus; assignedTo?: string | null }
) {
  if (patch.assignedTo) {
    const { items } = await listAssignees()
    if (!items.some((p) => p.id === patch.assignedTo)) {
      throw new ApiError("VALIDATION_FAILED", "Choose a valid assignee", {
        assignedTo: ["Not an assignable user"],
      })
    }
  }
  await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(leads)
      .where(eq(leads.id, id))
      .for("update")
    if (!current) throw new ApiError("NOT_FOUND", "Enquiry not found")

    const set: Partial<typeof leads.$inferInsert> = {}
    const diff: Record<string, { from: unknown; to: unknown }> = {}
    const events: { type: string; data: Record<string, unknown> }[] = []

    if (patch.status !== undefined && patch.status !== current.status) {
      set.status = patch.status
      set.statusChangedAt = new Date()
      if (current.status === "spam") set.spamReason = null
      diff.status = { from: current.status, to: patch.status }
      events.push({ type: "status", data: diff.status })
    }
    if (
      patch.assignedTo !== undefined &&
      patch.assignedTo !== current.assignedTo
    ) {
      set.assignedTo = patch.assignedTo
      diff.assignedTo = { from: current.assignedTo, to: patch.assignedTo }
      events.push({ type: "assignment", data: diff.assignedTo })
    }
    if (!events.length) return

    await tx.update(leads).set(set).where(eq(leads.id, id))
    // Distinct timestamps keep the timeline order stable inside one transaction.
    const base = Date.now()
    await tx.insert(leadActivities).values(
      events.map((e, i) => ({
        leadId: id,
        actorId: actor.userId,
        type: e.type,
        data: e.data,
        createdAt: new Date(base + i),
      }))
    )
    await audit(
      actor,
      {
        action: "lead.update",
        entityType: "lead",
        entityId: id,
        summary: "Enquiry updated",
        diff,
      },
      tx
    )
  })
  return getLead(id)
}

export async function addNote(actor: Actor, id: string, body: string) {
  return getDb().transaction(async (tx) => {
    const [exists] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.id, id))
    if (!exists) throw new ApiError("NOT_FOUND", "Enquiry not found")
    const [row] = await tx
      .insert(leadActivities)
      .values({ leadId: id, actorId: actor.userId, type: "note", body })
      .returning()
    await audit(
      actor,
      {
        action: "lead.note",
        entityType: "lead",
        entityId: id,
        summary: "Note added to an enquiry",
      },
      tx
    )
    return {
      id: row!.id,
      type: row!.type,
      body: row!.body,
      data: row!.data,
      actor: { id: actor.userId, name: actor.name },
      createdAt: row!.createdAt,
    } satisfies LeadActivity
  })
}

const EXPORT_COLUMNS = [
  { key: "createdAt", label: "Created" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "topicSlug", label: "Topic" },
  { key: "formatSlug", label: "Format" },
  { key: "planSlug", label: "Plan" },
  { key: "status", label: "Status" },
  { key: "spamReason", label: "Spam reason" },
  { key: "message", label: "Message" },
  { key: "privacyConsentAt", label: "Privacy consent at" },
  { key: "marketingConsent", label: "Marketing consent" },
  { key: "sourcePath", label: "Source path" },
  { key: "referrer", label: "Referrer" },
  { key: "utm_source", label: "utm_source" },
  { key: "utm_medium", label: "utm_medium" },
  { key: "utm_campaign", label: "utm_campaign" },
  { key: "utm_term", label: "utm_term" },
  { key: "utm_content", label: "utm_content" },
]

export async function exportLeads(
  actor: Actor,
  query: Pick<LeadListQuery, "folder" | "status">
) {
  const rows = await getDb()
    .select()
    .from(leads)
    .where(filters(actor, query))
    .orderBy(desc(leads.createdAt), desc(leads.id))
  const csv = toCsv(
    rows.map((r) => ({ ...r, ...r.utm })),
    EXPORT_COLUMNS
  )
  await audit(actor, {
    action: "lead.export",
    entityType: "lead",
    summary: `Exported ${rows.length} enquiries`,
  })
  return csv
}

export async function eraseLead(actor: Actor, id: string) {
  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .delete(leads)
      .where(eq(leads.id, id))
      .returning({ id: leads.id })
    if (!row) throw new ApiError("NOT_FOUND", "Enquiry not found")
    await audit(
      actor,
      {
        action: "lead.erase",
        entityType: "lead",
        entityId: id,
        summary: "Enquiry erased",
      },
      tx
    )
  })
  return { ok: true as const }
}

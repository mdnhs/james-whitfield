// server/modules/ai/tool-data.ts
import "server-only"

import { format } from "date-fns"
import { and, count, desc, eq, gte, ne, or, sql } from "drizzle-orm"

import { PageSeo } from "@/blocks/page"
import { hasPermission, type Permissions } from "@/lib/auth/permissions"
import { plainText } from "@/lib/content/reading-time"
import { matchesSearch } from "@/lib/search/normalize"
import { ApiError } from "@/server/api/errors"
import type { Actor } from "@/server/auth/actor"
import { getDb } from "@/server/db/client"
import { articles, leads } from "@/server/db/schema"
import { getArticle, listArticles } from "@/server/modules/articles/service"
import { ArticleListQuery } from "@/server/modules/articles/schema"
import { getDashboard } from "@/server/modules/dashboard/service"
import { DUBLIN } from "@/server/modules/dashboard/week"
import { getPage, listPages } from "@/server/modules/pages/service"
import { computeSeoHealth } from "@/server/modules/seo/health"

import { clip, flattenBlocks } from "./flatten"
import type { AiStored } from "./settings"

// Every result names what was looked at ("Looked at: About page", spec §8).
export type ToolResult = { label: string } & Record<string, unknown>

const DAY = 86_400_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_ACCESS = "You don't have access to that, so I can't look it up."

// Defence in depth: buildTools only offers permitted tools, and each tool
// still checks the actor itself (spec §5).
const allowed = (actor: Actor, ...options: Permissions[]) =>
  options.some((p) => hasPermission(actor.roles, p))
const refuse = (label: string): ToolResult => ({ label, error: NO_ACCESS })
const seoOf = (raw: unknown) => {
  // Stored SEO can drift from the schema; read what parses, never throw.
  const parsed = PageSeo.safeParse(raw ?? {})
  const s = parsed.success ? parsed.data : PageSeo.parse({})
  return { title: s.title, description: s.description, noindex: s.noindex }
}
const notFound = (e: unknown) => e instanceof ApiError && e.code === "NOT_FOUND"
const normalisePath = (raw: string) => {
  const p = `/${raw.trim().replace(/^\/+/, "")}`.toLowerCase()
  return p.length > 1 ? p.replace(/\/+$/, "") : p
}

export async function searchContent(
  actor: Actor,
  query: string
): Promise<ToolResult> {
  const label = `a search for “${query}”`
  const pagesOk = allowed(actor, { page: ["read"] })
  const articlesOk = allowed(actor, { article: ["read"] })
  if (!pagesOk && !articlesOk) return refuse(label)
  const results: Record<string, unknown>[] = []
  if (pagesOk) {
    const { items } = await listPages()
    for (const p of items
      .filter((p) => matchesSearch(query, [p.title, p.path]))
      .slice(0, 10))
      results.push({
        kind: "page",
        id: p.id,
        title: p.title,
        path: p.path,
        status: p.status,
      })
  }
  if (articlesOk) {
    const { items } = await listArticles(
      ArticleListQuery.parse({ q: query, page: 1, pageSize: 10 })
    )
    for (const a of items)
      results.push({
        kind: "article",
        id: a.id,
        title: a.title,
        path: `/insights/${a.slug}`,
        status: a.status,
      })
  }
  return { label, results }
}

export async function readPage(
  actor: Actor,
  idOrPath: string
): Promise<ToolResult> {
  if (!allowed(actor, { page: ["read"] })) return refuse("a page")
  let id = UUID.test(idOrPath) ? idOrPath : null
  if (!id) {
    const path = normalisePath(idOrPath)
    id = (await listPages()).items.find((p) => p.path === path)?.id ?? null
  }
  if (!id) return { label: idOrPath, error: `No page found for “${idOrPath}”.` }
  try {
    const page = await getPage(id)
    const { text, truncated } = flattenBlocks(page.draft)
    return {
      label: `${page.title} page`,
      id: page.id,
      title: page.title,
      path: page.path,
      status: page.status,
      hasUnpublishedChanges: page.hasUnpublishedChanges,
      seo: seoOf(page.seo),
      text,
      truncated,
    }
  } catch (e) {
    if (notFound(e))
      return { label: idOrPath, error: `No page found for “${idOrPath}”.` }
    throw e
  }
}

export async function readArticle(
  actor: Actor,
  idOrSlug: string
): Promise<ToolResult> {
  if (!allowed(actor, { article: ["read"] })) return refuse("an article")
  let id = UUID.test(idOrSlug) ? idOrSlug : null
  if (!id) {
    const slug = idOrSlug
      .trim()
      .replace(/^\/?insights\//, "")
      .replace(/\/+$/, "")
    // A live slug is unique and wins; draft slugs can repeat across
    // renames, so the most recently edited draft is the one meant.
    const [row] = await getDb()
      .select({ id: articles.id })
      .from(articles)
      .where(
        or(eq(articles.slug, slug), sql`${articles.draft}->>'slug' = ${slug}`)
      )
      .orderBy(
        sql`case when ${articles.slug} = ${slug} then 0 else 1 end`,
        desc(articles.updatedAt),
        articles.id
      )
      .limit(1)
    id = row?.id ?? null
  }
  if (!id)
    return { label: idOrSlug, error: `No article found for “${idOrSlug}”.` }
  try {
    const a = await getArticle(actor, id)
    const { text, truncated } = clip(plainText(a.draft.body))
    return {
      label: `the article “${a.draft.title}”`,
      id: a.id,
      title: a.draft.title,
      excerpt: a.draft.excerpt?.slice(0, 500),
      status: a.status,
      path: `/insights/${a.draft.slug || a.slug}`,
      seo: seoOf(a.seo),
      text,
      truncated,
    }
  } catch (e) {
    if (notFound(e))
      return { label: idOrSlug, error: `No article found for “${idOrSlug}”.` }
    throw e
  }
}

export async function seoHealth(actor: Actor): Promise<ToolResult> {
  if (!allowed(actor, { seo: ["read"] })) return refuse("SEO health")
  const h = await computeSeoHealth()
  return {
    label: "SEO health",
    score: h.score,
    passed: h.passed,
    total: h.total,
    issues: h.issues.slice(0, 40).map((i) => ({
      kind: i.kind,
      title: i.title,
      path: i.path,
      problem: i.message,
    })),
    moreIssues: Math.max(0, h.issues.length - 40),
    altText: h.alt,
  }
}

// Role-filtered KPIs only: `nextUp` names enquirers and `recentActivity`
// carries emails, so neither leaves this function (Review Focus 3).
export async function dashboardSummary(actor: Actor): Promise<ToolResult> {
  const d = await getDashboard(actor)
  return {
    label: "the dashboard",
    enquiriesLast30Days: d.enquiries,
    enquiriesThisWeek: {
      current: d.enquiriesWeek.current,
      previous: d.enquiriesWeek.previous,
    },
    articles: d.articles,
    subscribers: d.subscribers,
    seoHealth: d.seoHealth,
    contentHealth: d.contentHealth
      ? {
          ...d.contentHealth,
          findings: undefined,
          findingsTotal: d.contentHealth.findingsTotal,
        }
      : null,
  }
}

export const ENQUIRY_RANGES = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
} as const
export type EnquiryRange = keyof typeof ENQUIRY_RANGES

export async function enquiryStats(
  actor: Actor,
  settings: AiStored,
  range: EnquiryRange,
  now = new Date()
): Promise<ToolResult> {
  const since = new Date(now.getTime() - ENQUIRY_RANGES[range] * DAY)
  const where = and(ne(leads.status, "spam"), gte(leads.createdAt, since))
  const db = getDb()
  const week = sql<string>`to_char(date_trunc('week', ${leads.createdAt} at time zone 'Europe/Dublin'), 'YYYY-MM-DD')`
  const [byStatus, byTopic, byWeek] = await Promise.all([
    db
      .select({ status: leads.status, n: count() })
      .from(leads)
      .where(where)
      .groupBy(leads.status),
    db
      .select({ topic: leads.topicSlug, n: count() })
      .from(leads)
      .where(where)
      .groupBy(leads.topicSlug)
      .orderBy(desc(count()))
      .limit(15),
    db
      .select({ week, n: count() })
      .from(leads)
      .where(where)
      .groupBy(week)
      .orderBy(week),
  ])
  const result: ToolResult = {
    label: `enquiry numbers (last ${ENQUIRY_RANGES[range]} days)`,
    range,
    total: byStatus.reduce((t, r) => t + r.n, 0),
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])),
    byTopic: byTopic.map((r) => ({
      topic: r.topic || "unspecified",
      count: r.n,
    })),
    byWeek: byWeek.map((r) => ({ weekStarting: r.week, count: r.n })),
  }
  // Ruling R14: details need the owner's opt-in AND lead.read.
  if (
    settings.shareEnquiryDetails.enabled &&
    allowed(actor, { lead: ["read"] })
  ) {
    const rows = await db
      .select({
        name: leads.name,
        topic: leads.topicSlug,
        createdAt: leads.createdAt,
        message: leads.message,
      })
      .from(leads)
      .where(where)
      .orderBy(desc(leads.createdAt))
      .limit(20)
    result.recent = rows.map((r) => ({
      firstName: r.name.trim().split(/\s+/)[0] ?? "",
      topic: r.topic || "unspecified",
      date: format(r.createdAt, "yyyy-MM-dd", { in: DUBLIN }),
      message: r.message.slice(0, 500),
    }))
  }
  return result
}

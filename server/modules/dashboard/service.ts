import "server-only"

import { format } from "date-fns"

import { hasPermission } from "@/lib/auth/permissions"
import { roleRequiresTwoFactor } from "@/lib/auth/two-factor-policy"
import type { QaFinding } from "@/lib/content/qa"
import type { Actor } from "@/server/auth/actor"
import { getSeoHealth } from "@/server/modules/seo/queries"
import { listLiveEntities } from "@/server/modules/seo/live"

import { contentGauge, type ContentGauge } from "./content-health"
import { getContentFindings } from "./content-qa"
import * as repo from "./repo"
import { DUBLIN, weekWindow } from "./week"

export type NextUpItem = {
  id: "enquiry" | "article" | "two-factor" | "invite"
  title: string
  description: string
  cta: string
  href: string
  done: boolean
}
export type DashboardDto = {
  generatedAt: string
  enquiries: { value: number; previous: number }
  enquiriesWeek: {
    days: { key: string; label: string; current: number; previous: number }[]
    current: number
    previous: number
  }
  articles: { published: number; scheduled: number }
  subscribers: { confirmed: number; newThisMonth: number }
  seoHealth: { score: number; issues: number } | null
  contentHealth:
    | (ContentGauge & { findings: QaFinding[] | null; findingsTotal: number })
    | null
  recentActivity:
    | {
        id: string
        actorName: string | null
        actorEmail: string | null
        action: string
        summary: string
        createdAt: string
      }[]
    | null
  nextUp: NextUpItem[]
}

const DAY = 86_400_000
const FINDINGS_SHOWN = 10
const first = (name: string) => name.trim().split(/\s+/)[0] || "them"

function twoFactorStep(actor: Actor): NextUpItem {
  const required = roleRequiresTwoFactor(actor.roles)
  return {
    id: "two-factor",
    title: actor.twoFactorEnabled ? "Two-factor is on" : "Turn on two-factor",
    description: required
      ? "Required for your role. A code from your phone keeps your account safe even if your password leaks."
      : "Recommended. A code from your phone keeps your account safe even if your password leaks.",
    cta: "Set up two-factor",
    href: "/admin/two-factor-setup",
    done: actor.twoFactorEnabled,
  }
}

// docs/brief.md §9.3 Dashboard; RBAC per Ruling R3.
export async function getDashboard(
  actor: Actor,
  now: Date = new Date()
): Promise<DashboardDto> {
  const can = (p: Parameters<typeof hasPermission>[1]) =>
    hasPermission(actor.roles, p)
  const canLeads = can({ lead: ["read"] })
  const canArticles = can({ article: ["read"] })
  const canSeo = can({ seo: ["read"] })
  const canFix = can({ page: ["update"] })
  const canAudit = can({ audit: ["read"] })
  const canInvite = can({ user: ["create"] })
  const week = weekWindow(now)
  const monthAgo = new Date(now.getTime() - 30 * DAY)
  const twoMonthsAgo = new Date(now.getTime() - 60 * DAY)

  const [
    enquiries,
    enquiriesBefore,
    byDay,
    articleCounts,
    subscribers,
    oldest,
    scheduled,
    health,
    live,
    findings,
    recent,
    accounts,
  ] = await Promise.all([
    repo.enquiryCount(monthAgo, now),
    repo.enquiryCount(twoMonthsAgo, monthAgo),
    repo.enquiriesByDay(week.previousStart, week.end),
    repo.articleCounts(),
    repo.subscriberCounts(monthAgo),
    canLeads ? repo.oldestNewEnquiry() : null,
    canArticles ? repo.nextScheduledArticle() : null,
    canSeo ? getSeoHealth() : null,
    canSeo ? listLiveEntities() : null,
    canFix ? getContentFindings() : null,
    canAudit ? repo.recentAudit(8) : null,
    canInvite ? repo.accountCount() : null,
  ])

  const counts = new Map(byDay.map((row) => [row.day, row.count]))
  const days = week.days.map((day, index) => ({
    key: day.key,
    label: day.label,
    current: counts.get(day.key) ?? 0,
    previous: counts.get(week.previousDays[index]!.key) ?? 0,
  }))
  const sum = (key: "current" | "previous") =>
    days.reduce((t, d) => t + d[key], 0)

  const nextUp: NextUpItem[] = []
  if (oldest) {
    nextUp.push({
      id: "enquiry",
      title: `Reply to ${first(oldest.name)}`,
      description: `Waiting since ${format(oldest.createdAt, "d MMM", { in: DUBLIN })}: the oldest enquiry nobody has contacted yet.`,
      cta: "Open enquiry",
      href: `/admin/leads?lead=${oldest.id}`,
      done: false,
    })
  }
  if (scheduled?.scheduledFor) {
    nextUp.push({
      id: "article",
      title: `“${scheduled.title}” goes live`,
      description: `Scheduled for ${format(scheduled.scheduledFor, "d MMM 'at' HH:mm", { in: DUBLIN })}. Give it a last read.`,
      cta: "Open article",
      href: `/admin/insights/${scheduled.id}`,
      done: false,
    })
  }
  nextUp.push(twoFactorStep(actor))
  if (canInvite) {
    nextUp.push({
      id: "invite",
      title: "Invite your team",
      description:
        "Give each person their own account and only the role they need.",
      cta: "Invite teammates",
      href: "/admin/users",
      done: (accounts ?? 0) > 1,
    })
  }

  return {
    generatedAt: now.toISOString(),
    enquiries: { value: enquiries, previous: enquiriesBefore },
    enquiriesWeek: { days, current: sum("current"), previous: sum("previous") },
    articles: articleCounts,
    subscribers,
    seoHealth: health
      ? { score: health.score, issues: health.issues.length }
      : null,
    contentHealth:
      health && live
        ? {
            ...contentGauge(health, live),
            findings: findings?.slice(0, FINDINGS_SHOWN) ?? null,
            findingsTotal: findings?.length ?? 0,
          }
        : null,
    recentActivity:
      recent?.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })) ?? null,
    nextUp,
  }
}

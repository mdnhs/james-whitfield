import {
  formatDelta,
  formatNumber,
  type Delta,
} from "@/admin/components/dashboard/format"
import {
  toneForStatus,
  type StatusTone,
} from "@/admin/components/dashboard/status-pill"
import type { Permissions } from "@/lib/auth/permissions"

import type { Dashboard } from "./queries"

const HOUR = new Intl.DateTimeFormat("en-IE", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "Europe/Dublin",
})

// "Good morning, {name}" (docs/brief.md §9.3), by the clock in Ireland.
export function greetingFor(date: Date) {
  const hour = Number(HOUR.format(date))
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

export const firstName = (name: string) =>
  name.trim().split(/\s+/)[0] || "there"

// The time of day comes from the dashboard answer once it arrives (the
// server's clock when it built the numbers on screen), and until then from
// when the page was rendered. Never the render's own wall clock: the greeting
// then follows the data, and a test that pins the data pins the greeting.
export function dashboardGreeting(
  name: string,
  generatedAt: string | undefined,
  renderedAt: string
) {
  return `${greetingFor(new Date(generatedAt ?? renderedAt))}, ${name}`
}

const ACTION_LABELS: Record<string, string> = {
  "auth.sign_in": "Signed in",
  "auth.impersonate": "Viewed as",
  "user.invite": "Invited",
  "user.bootstrap-owner": "Created",
  "article.publish": "Published",
  "page.publish": "Published",
  "user.role": "Role changed",
  "lead.update": "Updated",
}

export function actionStatus(
  action: string
): { label: string; tone: StatusTone } | undefined {
  const label = ACTION_LABELS[action]
  return label ? { label, tone: toneForStatus(label) } : undefined
}

export type KpiProps = {
  label: string
  value: string
  caption: string
  delta: Delta | null
  href?: string
  variant?: "hero" | "default"
}

const plural = (n: number, one: string, many: string) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`

// docs/brief.md §9.3 KPI row. Links appear only when the viewer can open
// the page behind them (Ruling R3).
export function kpisFor(
  data: Dashboard,
  can: (p: Permissions) => boolean
): KpiProps[] {
  // No baseline (a quiet previous period) means no comparison to caption.
  const enquiryDelta =
    data.enquiries.previous > 0
      ? formatDelta(data.enquiries.value, data.enquiries.previous)
      : null
  const link = (allowed: boolean, href: string) => (allowed ? { href } : {})
  const kpis: KpiProps[] = [
    {
      label: "New enquiries",
      value: formatNumber(data.enquiries.value),
      delta: enquiryDelta,
      caption: enquiryDelta ? "vs the 30 days before" : "last 30 days",
      variant: "hero",
      ...link(can({ lead: ["read"] }), "/admin/leads"),
    },
    {
      label: "Published articles",
      value: formatNumber(data.articles.published),
      delta: null,
      caption: data.articles.scheduled
        ? `${formatNumber(data.articles.scheduled)} scheduled`
        : "none scheduled",
      ...link(can({ article: ["read"] }), "/admin/insights"),
    },
    {
      label: "Newsletter subscribers",
      value: formatNumber(data.subscribers.confirmed),
      delta: null,
      caption: `${formatNumber(data.subscribers.newThisMonth)} new in 30 days`,
      ...link(can({ newsletter: ["read"] }), "/admin/newsletter"),
    },
  ]
  if (data.seoHealth) {
    kpis.push({
      label: "SEO health",
      value: `${data.seoHealth.score}%`,
      delta: null,
      caption: data.seoHealth.issues
        ? `${plural(data.seoHealth.issues, "issue", "issues")} to fix`
        : "nothing to fix",
      href: "/admin/seo",
    })
  }
  return kpis
}

const SETUP = new Set(["two-factor", "invite"])
export const setupSteps = (items: Dashboard["nextUp"]) =>
  items.filter((item) => SETUP.has(item.id))

import type { ActivityEntry } from "@/admin/components/dashboard/activity-feed"
import type { GaugePart } from "@/admin/components/dashboard/chart-math"
import type { PillBarDatum } from "@/admin/components/dashboard/pill-bar-chart"

// Fixed sample data for client demos and visual tests. Real dashboard data
// arrives in Task 2.8 (what exists now) and Phase 11 (enquiries, content).
export const SAMPLE_NOW = Date.parse("2026-10-09T10:00:00Z")

export const SAMPLE_KPIS = [
  {
    label: "New enquiries",
    value: "24",
    delta: { label: "+3.4%", direction: "up" as const },
    caption: "vs last month",
    href: "/admin/leads",
    variant: "hero" as const,
  },
  {
    label: "Published articles",
    value: "10",
    delta: { label: "+2.1%", direction: "up" as const },
    caption: "vs last month",
    href: "/admin/insights",
  },
  {
    label: "Newsletter subscribers",
    value: "312",
    delta: { label: "+1.1%", direction: "up" as const },
    caption: "vs last month",
    href: "/admin/newsletter",
  },
  {
    label: "SEO health",
    value: "86%",
    delta: null,
    caption: "4 pages need attention",
    href: "/admin/seo",
  },
]

export const SAMPLE_WEEK: PillBarDatum[] = [
  { key: "mon", label: "Mon", current: 4, previous: 3 },
  { key: "tue", label: "Tue", current: 6, previous: 5 },
  { key: "wed", label: "Wed", current: 5, previous: 7 },
  { key: "thu", label: "Thu", current: 9, previous: 6 },
  { key: "fri", label: "Fri", current: 3, previous: 8 },
  { key: "sat", label: "Sat", current: 1, previous: 2 },
  { key: "sun", label: "Sun", current: 2, previous: 3 },
]

export const SAMPLE_TEAM: ActivityEntry[] = [
  {
    id: "a1",
    name: "Niamh Walsh",
    description: "Published “Sleep and stress”",
    at: "2026-10-09T09:20:00Z",
    status: { label: "Published", tone: "success" },
  },
  {
    id: "a2",
    name: "Ciarán Doyle",
    description: "Editing the About page",
    at: "2026-10-09T08:05:00Z",
    status: { label: "In progress", tone: "warning" },
  },
  {
    id: "a3",
    name: "Aoife Byrne",
    description: "New enquiry from the contact form",
    at: "2026-10-08T16:40:00Z",
    status: { label: "New", tone: "info" },
  },
  {
    id: "a4",
    name: "Seán Murphy",
    description: "Scheduled “Finding calm at work”",
    at: "2026-10-07T11:00:00Z",
    status: { label: "Pending", tone: "danger" },
  },
]

export const SAMPLE_CONTENT_HEALTH: GaugePart[] = [
  { key: "complete", label: "Complete", value: 41, tone: "solid" },
  { key: "work", label: "Needs work", value: 30, tone: "dark" },
  { key: "missing", label: "Missing SEO or alt", value: 29, tone: "hatched" },
]

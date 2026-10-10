import { formatBadge } from "@/admin/components/shell/format-badge"
import type { LeadStatus } from "@/lib/leads/schema"

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  booked: "Booked",
  closed: "Closed",
  spam: "Spam",
}

export const statusLabel = (status: LeadStatus) => STATUS_LABEL[status]

export type PillTone = "success" | "warning" | "danger" | "info" | "neutral"

const STATUS_TONE: Record<LeadStatus, PillTone> = {
  new: "info",
  contacted: "warning",
  booked: "success",
  closed: "neutral",
  spam: "danger",
}

export const statusTone = (status: LeadStatus): PillTone => STATUS_TONE[status]

// The API sends status as a plain string; unknown values read as they are.
export const isLeadStatus = (value: string): value is LeadStatus =>
  Object.hasOwn(STATUS_LABEL, value)

export const statusText = (value: string) =>
  isLeadStatus(value) ? STATUS_LABEL[value] : value

const SPAM_REASON: Record<string, string> = {
  honeypot: "Hidden field filled in",
  stamp: "Form stamp missing or expired",
  "too-fast": "Submitted too quickly",
  turnstile: "Failed the Turnstile check",
}

export const spamReasonLabel = (reason: string | null) =>
  reason ? (SPAM_REASON[reason] ?? reason) : "Unknown"

// "mental-health-support" -> "Mental health support".
export function topicLabel(slug: string) {
  const text = slug.replaceAll("-", " ").trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "General"
}

// The sidebar pill: hidden at 0, capped at 99+.
export function badgeText(count: number | undefined) {
  if (!count || count <= 0) return null
  return formatBadge(count)
}

const WHEN = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Dublin",
})

// Irish time, as every other admin timestamp.
export const formatWhen = (iso: string) => WHEN.format(new Date(iso))

import { cn } from "@/lib/utils"

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral"

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-accent text-accent-foreground",
  neutral: "bg-muted text-muted-foreground",
}

// Published / Draft / Scheduled / New / Contacted… (docs/brief.md §9.2).
const STATUS_TONES: Record<string, StatusTone> = {
  published: "success",
  completed: "success",
  booked: "success",
  "signed in": "success",
  draft: "neutral",
  closed: "neutral",
  scheduled: "info",
  new: "info",
  invited: "info",
  "in progress": "warning",
  contacted: "warning",
  pending: "danger",
  failed: "danger",
}

export const toneForStatus = (status: string): StatusTone =>
  STATUS_TONES[status.trim().toLowerCase()] ?? "neutral"

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs font-semibold whitespace-nowrap",
        TONE_CLASS[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

import { cn } from "@/lib/utils"

import { formatWhen, statusText } from "./present"
import type { LeadActivity } from "./queries"

type Line = { text: string; detail?: string; failed?: boolean }

const KIND_LABEL: Record<string, string> = {
  notification: "Notification email",
  "auto-reply": "Auto-reply email",
}

function describe(
  activity: LeadActivity,
  assigneeName: (id: string | null) => string | undefined
): Line {
  const data = activity.data as Record<string, unknown>
  if (activity.type === "note") return { text: "Note", detail: activity.body }
  if (activity.type === "status") {
    const from = typeof data.from === "string" ? statusText(data.from) : "?"
    const to = typeof data.to === "string" ? statusText(data.to) : "?"
    return { text: `Status changed from ${from} to ${to}` }
  }
  if (activity.type === "assignment") {
    const to = typeof data.to === "string" ? data.to : null
    return {
      text: to
        ? `Assigned to ${assigneeName(to) ?? "a team member"}`
        : "Unassigned",
    }
  }
  if (activity.type === "email") {
    const label = KIND_LABEL[String(data.kind)] ?? "Email"
    return data.status === "failed"
      ? { text: `${label} failed`, failed: true }
      : { text: `${label} sent` }
  }
  return { text: activity.body || activity.type }
}

// Oldest first, newest last (the API already sorts).
export function LeadTimeline({
  activities,
  assigneeName,
}: {
  activities: LeadActivity[]
  assigneeName: (id: string | null) => string | undefined
}) {
  if (activities.length === 0)
    return <p className="text-sm text-muted-foreground">Nothing yet.</p>
  return (
    <ol className="flex flex-col gap-3">
      {activities.map((activity) => {
        const line = describe(activity, assigneeName)
        return (
          <li
            key={activity.id}
            data-failed={line.failed || undefined}
            className="flex flex-col gap-0.5 text-sm"
          >
            <span
              className={cn("font-medium", line.failed && "text-destructive")}
            >
              {line.text}
            </span>
            {line.detail ? (
              <span className="whitespace-pre-wrap">{line.detail}</span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {activity.actor ? `${activity.actor.name} · ` : ""}
              <time dateTime={activity.createdAt}>
                {formatWhen(activity.createdAt)}
              </time>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

import {
  toneForStatus,
  type StatusTone,
} from "@/admin/components/dashboard/status-pill"

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

const ACTION_LABELS: Record<string, string> = {
  "auth.sign_in": "Signed in",
  "auth.impersonate": "Viewed as",
  "user.invite": "Invited",
  "user.bootstrap-owner": "Created",
}

export function actionStatus(
  action: string
): { label: string; tone: StatusTone } | undefined {
  const label = ACTION_LABELS[action]
  return label ? { label, tone: toneForStatus(label) } : undefined
}

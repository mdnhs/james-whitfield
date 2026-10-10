// The admin bell (docs/brief.md §9.1, §12.5; Ruling R6). Isomorphic.
export const NOTIFICATION_KINDS = [
  "enquiry",
  "delivery_failed",
  "published",
  "schedule_failed",
  "review_requested",
  "capi_failed",
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]
export type NotificationItem = {
  id: string
  kind: NotificationKind
  title: string
  description: string
  href: string
  at: string
  unread: boolean
}
export type NotificationsDto = {
  items: NotificationItem[]
  unread: number
  seenAt: string
}

export const POLL_MS = 60_000
export const NOTIFICATION_LIMIT = 20
export const NOTIFICATION_WINDOW_DAYS = 30

export const badgeText = (unread: number) =>
  unread > 9 ? "9+" : String(unread)

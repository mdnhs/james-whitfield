"use client"

import { formatDistanceToNow } from "date-fns"
import {
  ActivityIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleMinusIcon,
  CircleXIcon,
  type LucideIcon,
} from "lucide-react"
import { useId } from "react"

import {
  StatusPill,
  type StatusTone,
} from "@/admin/components/dashboard/status-pill"

import type { TrackingAdminDoc } from "./queries"

type Status = TrackingAdminDoc["status"][keyof TrackingAdminDoc["status"]]

export const STATUS_LABELS: Record<Status, string> = {
  off: "Off",
  ready: "Ready",
  "missing-id": "Add the ID",
  "needs-gtm": "Needs GTM",
  "needs-banner": "Turn on the consent banner",
  "needs-pixel": "Needs the Pixel ID",
  "no-token": "Add the access token",
  "no-key": "Server key missing (APP_ENCRYPTION_KEY)",
  "unreadable-token": "Token can't be read; enter it again",
}

const TONES: Record<Status, StatusTone> = {
  off: "neutral",
  ready: "success",
  "missing-id": "warning",
  "needs-gtm": "warning",
  "needs-banner": "warning",
  "needs-pixel": "warning",
  "no-token": "warning",
  "no-key": "danger",
  "unreadable-token": "danger",
}

const TONE_ICONS: Partial<Record<StatusTone, LucideIcon>> = {
  success: CircleCheckIcon,
  warning: CircleAlertIcon,
  danger: CircleXIcon,
  neutral: CircleMinusIcon,
}

const CHANNELS = [
  ["gtm", "Google Tag Manager"],
  ["ga4", "GA4"],
  ["meta", "Meta Pixel"],
  ["capi", "Conversions API"],
] as const

export function TrackingStatus({ doc }: { doc: TrackingAdminDoc }) {
  const headingId = useId()
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-card flex flex-col gap-3 bg-card p-5 sm:p-6"
    >
      <h2 id={headingId} className="text-card-title flex items-center gap-2">
        <ActivityIcon aria-hidden className="size-4 text-muted-foreground" />
        Status
      </h2>
      {/* One compact row per provider: name, then a pill with its state. */}
      <ul className="flex flex-col gap-2">
        {CHANNELS.map(([key, name]) => {
          const tone = TONES[doc.status[key]]
          const Icon = TONE_ICONS[tone] ?? CircleMinusIcon
          return (
            <li
              key={key}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
            >
              <span className="font-medium">{name}</span>
              <StatusPill
                tone={tone}
                className="inline-flex items-center gap-1"
              >
                <Icon aria-hidden className="size-3.5 shrink-0" />
                <span>{STATUS_LABELS[doc.status[key]]}</span>
              </StatusPill>
            </li>
          )
        })}
      </ul>
      {doc.lastCapiFailure ? (
        <p className="text-sm text-muted-foreground">
          Last Conversions API failure: {doc.lastCapiFailure.summary} (
          {formatDistanceToNow(new Date(doc.lastCapiFailure.at), {
            addSuffix: true,
          })}
          )
        </p>
      ) : null}
    </section>
  )
}

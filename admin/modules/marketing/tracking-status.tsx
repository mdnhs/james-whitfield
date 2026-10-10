"use client"

import { formatDistanceToNow } from "date-fns"
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

const CHANNELS = [
  ["gtm", "Google Tag Manager"],
  ["ga4", "GA4"],
  ["meta", "Meta Pixel"],
  ["capi", "Conversions API"],
] as const

export function TrackingStatus({ doc }: { doc: TrackingAdminDoc }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg font-semibold">
        Status
      </h2>
      <ul className="flex flex-col divide-y rounded-xl border">
        {CHANNELS.map(([key, name]) => (
          <li
            key={key}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          >
            <span className="font-medium">{name}</span>
            <StatusPill tone={TONES[doc.status[key]]}>
              {STATUS_LABELS[doc.status[key]]}
            </StatusPill>
          </li>
        ))}
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

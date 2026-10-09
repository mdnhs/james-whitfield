import {
  createLoader,
  parseAsInteger,
  parseAsIsoDate,
  parseAsString,
} from "nuqs/server"

import type { AuditListParams } from "@/admin/lib/query-keys"

// URL state for /admin/activity, shared by the RSC prefetch and the client
// (docs/brief.md §8.4: table state mirrors into the URL and is the key).
export const activityParsers = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(20),
  action: parseAsString,
  actor: parseAsString,
  from: parseAsIsoDate,
  to: parseAsIsoDate,
}

export const loadActivityParams = createLoader(activityParsers)

// The one date helper. parseAsIsoDate reads YYYY-MM-DD as UTC midnight, so
// slicing the ISO string gives the same calendar day back (and a date input
// the value it expects).
export const toDay = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : undefined

export function toAuditParams(state: {
  page: number
  pageSize: number
  action: string | null
  actor: string | null
  from: Date | null
  to: Date | null
}): AuditListParams {
  return {
    page: Math.max(1, Math.trunc(state.page)),
    pageSize: Math.min(100, Math.max(1, Math.trunc(state.pageSize))),
    action: state.action ?? undefined,
    actor: state.actor ?? undefined,
    from: toDay(state.from),
    to: toDay(state.to),
  }
}

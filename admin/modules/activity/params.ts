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
// the value it expects). An Invalid Date (a date input can hold a six-digit
// year) is no day at all.
export function toDay(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return undefined
  const day = date.toISOString().slice(0, 10)
  // Years beyond 9999 serialise as "+275759-12"; that is not a day either.
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// URL state is hand-editable and shareable: anything the API would reject is
// dropped here so a bad link shows sensible results, not a raw 400.
export function toAuditParams(state: {
  page: number
  pageSize: number
  action: string | null
  actor: string | null
  from: Date | null
  to: Date | null
}): AuditListParams {
  const action = state.action?.trim()
  let from = toDay(state.from)
  let to = toDay(state.to)
  if (from && to && from > to) [from, to] = [to, from]
  return {
    page: Math.max(1, Math.trunc(state.page) || 1),
    pageSize: Math.min(100, Math.max(1, Math.trunc(state.pageSize) || 20)),
    action: action && action.length <= 64 ? action : undefined,
    actor: state.actor && UUID.test(state.actor) ? state.actor : undefined,
    from,
    to,
  }
}

import "server-only"

import * as z from "zod"

// docs/brief.md §8.2–8.3: list conventions plus the audit filters. Dates are
// Irish calendar days (YYYY-MM-DD), both ends inclusive.
const Filters = {
  actor: z.uuid().optional(),
  action: z.string().trim().min(1).max(64).optional(),
  entityType: z.string().trim().min(1).max(32).optional(),
  entityId: z.string().trim().min(1).max(64).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
}

const ordered = <T extends { from?: string; to?: string }>(query: T) =>
  !query.from || !query.to || query.from <= query.to

const ORDER_MESSAGE = {
  message: "The end date must be on or after the start date",
  path: ["to"],
}

export const AuditListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    ...Filters,
  })
  .refine(ordered, ORDER_MESSAGE)

export type AuditListQuery = z.output<typeof AuditListQuery>

export const AuditExportQuery = z.object(Filters).refine(ordered, ORDER_MESSAGE)

export type AuditExportQuery = z.output<typeof AuditExportQuery>

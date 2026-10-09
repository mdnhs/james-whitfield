import "server-only"

import * as z from "zod"

// docs/brief.md §8.2–8.3: list conventions plus the audit filters. Dates are
// Irish calendar days (YYYY-MM-DD), both ends inclusive.
export const AuditListQuery = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    actor: z.uuid().optional(),
    action: z.string().trim().min(1).max(64).optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "The end date must be on or after the start date",
    path: ["to"],
  })

export type AuditListQuery = z.output<typeof AuditListQuery>

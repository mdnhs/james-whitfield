// The admin's query-key factory (docs/brief.md §8.4). Table state from the
// URL is part of the key, so each filter combination is its own entry.
export type AuditListParams = {
  page: number
  pageSize: number
  actor?: string
  action?: string
  from?: string
  to?: string
}

export const queryKeys = {
  search: (q: string) => ["search", q.trim().toLowerCase()] as const,
  dashboard: ["dashboard"] as const,
  audit: {
    all: ["audit"] as const,
    list: (params: AuditListParams) => ["audit", "list", params] as const,
    facets: ["audit", "facets"] as const,
  },
  account: {
    sessions: ["account", "sessions"] as const,
  },
}

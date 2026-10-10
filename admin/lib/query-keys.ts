import { normaliseSearch } from "@/lib/search/normalize"

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
  search: (q: string) => ["search", normaliseSearch(q)] as const,
  dashboard: ["dashboard"] as const,
  audit: {
    all: ["audit"] as const,
    list: (params: AuditListParams) => ["audit", "list", params] as const,
    facets: ["audit", "facets"] as const,
  },
  pages: {
    all: ["pages"] as const,
    list: ["pages", "list"] as const,
    detail: (id: string) => ["pages", "detail", id] as const,
    revisions: (id: string) => ["pages", "revisions", id] as const,
  },
  articles: {
    all: ["articles"] as const,
    list: (params: object) => ["articles", "list", params] as const,
    detail: (id: string) => ["articles", "detail", id] as const,
    revisions: (id: string) => ["articles", "revisions", id] as const,
  },
  categories: ["categories"] as const,
  authors: ["authors"] as const,
  media: {
    all: ["media"] as const,
    list: (params: object) => ["media", "list", params] as const,
    usage: (id: string) => ["media", "usage", id] as const,
  },
  collections: {
    all: ["collections"] as const,
    list: (name: string) => ["collections", name, "list"] as const,
    options: (source: string) => ["collections", source, "options"] as const,
  },
  globals: {
    detail: (key: string) => ["globals", key] as const,
    revisions: (key: string) => ["globals", key, "revisions"] as const,
  },
  leads: {
    all: ["leads"] as const,
    list: (params: Record<string, unknown>) =>
      ["leads", "list", params] as const,
    detail: (id: string) => ["leads", "detail", id] as const,
    stats: ["leads", "stats"] as const,
    assignees: ["leads", "assignees"] as const,
  },
  account: {
    sessions: ["account", "sessions"] as const,
  },
}

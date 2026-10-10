import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { leadsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export type LeadsPage = InferResponseType<typeof leadsApi.index.$get, 200>
export type LeadRow = LeadsPage["items"][number]
export type LeadDetail = InferResponseType<
  (typeof leadsApi)[":id"]["$get"],
  200
>
export type LeadActivity = LeadDetail["activities"][number]

export type LeadsListParams = {
  folder: "inbox" | "spam"
  status?: "new" | "contacted" | "booked" | "closed"
  q?: string
  page: number
  pageSize: number
}

function toQuery(params: LeadsListParams) {
  return {
    folder: params.folder,
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.status ? { status: params.status } : {}),
    ...(params.q ? { q: params.q } : {}),
  }
}

export const leadsListQuery = (params: LeadsListParams) =>
  queryOptions({
    queryKey: queryKeys.leads.list(params),
    queryFn: () =>
      parseResponse(leadsApi.index.$get({ query: toQuery(params) })),
  })

export const leadDetailQuery = (id: string) =>
  queryOptions({
    queryKey: queryKeys.leads.detail(id),
    queryFn: () => parseResponse(leadsApi[":id"].$get({ param: { id } })),
  })

export const assigneesQuery = (enabled: boolean) =>
  queryOptions({
    queryKey: queryKeys.leads.assignees,
    queryFn: () => parseResponse(leadsApi.assignees.$get()),
    enabled,
    staleTime: 5 * 60_000,
  })

export function exportHref(params: Pick<LeadsListParams, "folder" | "status">) {
  const search = new URLSearchParams({ folder: params.folder })
  if (params.status) search.set("status", params.status)
  return `/api/v1/admin/leads/export.csv?${search}`
}

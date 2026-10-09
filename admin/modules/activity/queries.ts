import { queryOptions } from "@tanstack/react-query"
import type { InferResponseType } from "hono/client"

import { auditApi, parseResponse } from "@/admin/lib/api"
import { queryKeys, type AuditListParams } from "@/admin/lib/query-keys"

type AuditClient = typeof auditApi

export type AuditPage = InferResponseType<typeof auditApi.index.$get, 200>
export type AuditRow = AuditPage["items"][number]

function toQuery(params: AuditListParams) {
  return {
    page: String(params.page),
    pageSize: String(params.pageSize),
    ...(params.action ? { action: params.action } : {}),
    ...(params.actor ? { actor: params.actor } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  }
}

// `client` is the browser's auditApi, or inProcessAuditApi() in the RSC.
export const auditListQuery = (
  params: AuditListParams,
  client: AuditClient = auditApi
) =>
  queryOptions({
    queryKey: queryKeys.audit.list(params),
    queryFn: () => parseResponse(client.index.$get({ query: toQuery(params) })),
  })

export const auditFacetsQuery = (client: AuditClient = auditApi) =>
  queryOptions({
    queryKey: queryKeys.audit.facets,
    queryFn: () => parseResponse(client.facets.$get()),
    staleTime: 5 * 60_000,
  })

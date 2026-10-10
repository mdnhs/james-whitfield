"use client"

import { useQuery } from "@tanstack/react-query"

import { leadsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"

export function useNewLeadsCount(enabled: boolean) {
  const { data } = useQuery({
    queryKey: queryKeys.leads.stats,
    queryFn: () => parseResponse(leadsApi.stats.$get()),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
  return data?.new
}

import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { getQueryClient } from "@/admin/lib/query-client"
import { ActivityView } from "@/admin/modules/activity/activity-view"
import {
  loadActivityParams,
  toAuditParams,
} from "@/admin/modules/activity/params"
import {
  auditFacetsQuery,
  auditListQuery,
} from "@/admin/modules/activity/queries"
import { permissionFor } from "@/lib/admin/nav"
import { inProcessAuditApi } from "@/server/api/in-process"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Activity log" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default function ActivityPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Activity searchParams={searchParams} />
    </Suspense>
  )
}

async function Activity({ searchParams }: { searchParams: SearchParams }) {
  // Gated by the registry entry that lists the link, so the two cannot drift.
  await requirePermission(permissionFor("/admin/activity"))
  const params = toAuditParams(loadActivityParams(await searchParams))
  const queryClient = getQueryClient()
  const client = inProcessAuditApi()
  // A failed prefetch is not fatal: the client query retries and shows its
  // own error state.
  await Promise.all([
    queryClient.query(auditListQuery(params, client)),
    queryClient.query(auditFacetsQuery(client)),
  ]).catch(() => undefined)
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ActivityView />
    </HydrationBoundary>
  )
}

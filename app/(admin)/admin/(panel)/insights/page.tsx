import type { Metadata } from "next"
import { Suspense } from "react"

import { ArticlesPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { ArticlesView } from "@/admin/modules/insights/articles-view"
import { InsightsTabs } from "@/admin/modules/insights/insights-tabs"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Insights" }

export default function InsightsPage() {
  return (
    <Suspense fallback={<ArticlesPageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/insights"))
  return (
    <div className="flex flex-col gap-6">
      <InsightsTabs />
      <ArticlesView />
    </div>
  )
}

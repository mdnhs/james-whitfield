import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { TaxonomyView } from "@/admin/modules/insights/taxonomy-view"
import { InsightsTabs } from "@/admin/modules/insights/insights-tabs"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Authors" }

export default function AuthorsPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/insights"))
  return (
    <div className="flex flex-col gap-6">
      <InsightsTabs />
      <TaxonomyView name="authors" />
    </div>
  )
}

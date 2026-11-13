import type { Metadata } from "next"
import { Suspense } from "react"

import { TaxonomyPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { TaxonomyView } from "@/admin/modules/insights/taxonomy-view"
import { InsightsTabs } from "@/admin/modules/insights/insights-tabs"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Categories" }

export default function CategoriesPage() {
  return (
    <Suspense fallback={<TaxonomyPageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/insights"))
  return (
    <div className="flex flex-col gap-6">
      <InsightsTabs />
      <TaxonomyView name="categories" />
    </div>
  )
}

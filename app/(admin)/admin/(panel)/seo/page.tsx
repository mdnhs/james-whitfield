import type { Metadata } from "next"
import { Suspense } from "react"

import { SeoOverviewSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { SeoOverviewView } from "@/admin/modules/seo/seo-overview-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "SEO" }

export default function SeoPage() {
  return (
    <Suspense fallback={<SeoOverviewSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/seo"))
  return <SeoOverviewView />
}

import type { Metadata } from "next"
import { Suspense } from "react"

import { SeoDefaultsSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { SeoDefaultsView } from "@/admin/modules/seo/seo-defaults-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "SEO defaults" }

export default function SeoDefaultsPage() {
  return (
    <Suspense fallback={<SeoDefaultsSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/seo/defaults"))
  return <SeoDefaultsView />
}

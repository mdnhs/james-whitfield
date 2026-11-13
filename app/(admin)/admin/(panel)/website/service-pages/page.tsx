import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { ServicePagesView } from "@/admin/modules/website/service-pages-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Service pages" }

export default function ServicePages() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/website/service-pages"))
  return <ServicePagesView />
}

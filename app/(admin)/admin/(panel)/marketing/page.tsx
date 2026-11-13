import type { Metadata } from "next"
import { Suspense } from "react"

import { TrackingPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { TrackingView } from "@/admin/modules/marketing/tracking-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Tracking" }

export default function TrackingPage() {
  return (
    <Suspense fallback={<TrackingPageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/marketing"))
  return <TrackingView />
}

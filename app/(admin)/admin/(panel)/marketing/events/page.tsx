import type { Metadata } from "next"
import { Suspense } from "react"

import { EventsPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { EventsView } from "@/admin/modules/marketing/events-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Event catalogue" }

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsPageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/marketing/events"))
  return <EventsView />
}

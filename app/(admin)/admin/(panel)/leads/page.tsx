import type { Metadata } from "next"
import { Suspense } from "react"

import { LeadsPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { LeadsView } from "@/admin/modules/leads/leads-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Enquiries" }

export default function LeadsPage() {
  return (
    <Suspense fallback={<LeadsPageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/leads"))
  return <LeadsView />
}

import type { Metadata } from "next"
import { Suspense } from "react"

import { AppearancePageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { AppearanceView } from "@/admin/modules/appearance/appearance-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Appearance" }

export default function AppearancePage() {
  return (
    <Suspense fallback={<AppearancePageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/appearance"))
  return <AppearanceView />
}

import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { AppearanceView } from "@/admin/modules/appearance/appearance-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Appearance" }

export default function AppearancePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/appearance"))
  return <AppearanceView />
}

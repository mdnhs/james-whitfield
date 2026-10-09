import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { PagesView } from "@/admin/modules/pages/pages-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Pages" }

export default function PagesPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/pages"))
  return <PagesView />
}

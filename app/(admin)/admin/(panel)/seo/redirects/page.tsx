import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { RedirectsView } from "@/admin/modules/seo/redirects-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Redirects" }

export default function RedirectsPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/seo/redirects"))
  return <RedirectsView />
}

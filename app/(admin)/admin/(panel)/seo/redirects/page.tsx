import type { Metadata } from "next"
import { Suspense } from "react"

import { RedirectsPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { RedirectsView } from "@/admin/modules/seo/redirects-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Redirects" }

export default function RedirectsPage() {
  return (
    <Suspense fallback={<RedirectsPageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/seo/redirects"))
  return <RedirectsView />
}

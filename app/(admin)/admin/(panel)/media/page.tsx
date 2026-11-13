import type { Metadata } from "next"
import { Suspense } from "react"

import { MediaPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { MediaView } from "@/admin/modules/media/media-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Media" }

export default function MediaPage() {
  return (
    <Suspense fallback={<MediaPageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/media"))
  return <MediaView />
}

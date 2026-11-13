import type { Metadata } from "next"
import { Suspense } from "react"

import { ServiceEditorSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { NewServiceEditor } from "@/admin/modules/website/service-editor"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Add service" }

export default function AddService() {
  return (
    <Suspense fallback={<ServiceEditorSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission({ collection: ["create"] })
  return <NewServiceEditor />
}

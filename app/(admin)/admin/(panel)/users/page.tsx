import type { Metadata } from "next"
import { Suspense } from "react"

import { UsersPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { UsersView } from "@/admin/modules/users/users-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Users & roles" }

export default function UsersPage() {
  return (
    <Suspense fallback={<UsersPageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/users"))
  return <UsersView />
}

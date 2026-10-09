import { redirect } from "next/navigation"
import { Suspense } from "react"

import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export default function CollectionsIndex() {
  return (
    <Suspense>
      <Go />
    </Suspense>
  )
}

async function Go(): Promise<never> {
  await requirePermission(permissionFor("/admin/collections"))
  redirect("/admin/collections/services")
}

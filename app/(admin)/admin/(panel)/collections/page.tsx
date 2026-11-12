import { redirect } from "next/navigation"
import { Suspense } from "react"

import { permissionFor } from "@/lib/admin/nav"
import { websiteHref } from "@/lib/admin/website"
import { requirePermission } from "@/server/auth/session"

export default function CollectionsIndex() {
  return (
    <Suspense>
      <Go />
    </Suspense>
  )
}

async function Go(): Promise<never> {
  await requirePermission(permissionFor(websiteHref("home")))
  redirect(websiteHref("home"))
}

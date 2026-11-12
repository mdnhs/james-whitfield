import { redirect } from "next/navigation"
import { Suspense } from "react"

import { permissionFor } from "@/lib/admin/nav"
import { websiteHref } from "@/lib/admin/website"
import { requirePermission } from "@/server/auth/session"

export default function PagesIndex() {
  return (
    <Suspense>
      <Go />
    </Suspense>
  )
}

// The page list is gone: every public page has its own Website screen.
async function Go(): Promise<never> {
  await requirePermission(permissionFor(websiteHref("home")))
  redirect(websiteHref("home"))
}

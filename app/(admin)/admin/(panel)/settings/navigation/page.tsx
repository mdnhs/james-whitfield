import { redirect } from "next/navigation"
import { Suspense } from "react"

import { requirePermission } from "@/server/auth/session"

export default function MovedToHeaderFooter() {
  return (
    <Suspense>
      <Go />
    </Suspense>
  )
}

// Navigation and footer now live on one Website screen.
async function Go(): Promise<never> {
  await requirePermission({ globals: ["read"] })
  redirect("/admin/website/header-footer")
}

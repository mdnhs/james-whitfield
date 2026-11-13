import type { Metadata } from "next"
import { Suspense } from "react"

import { HelpArticleSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { HelpOverview } from "@/admin/modules/help/help-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Help" }

export default function HelpPage() {
  return (
    <Suspense fallback={<HelpArticleSkeleton />}>
      <Overview />
    </Suspense>
  )
}

async function Overview() {
  // Gated by HELP_LINK, the footer dock's entry for this page.
  const actor = await requirePermission(permissionFor("/admin/help"))
  return <HelpOverview roles={actor.roles} />
}

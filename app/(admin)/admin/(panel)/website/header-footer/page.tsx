import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { GlobalEditor } from "@/admin/modules/globals/global-editor"
import { permissionFor } from "@/lib/admin/nav"
import { SETTINGS_PAGES } from "@/lib/content/global-access"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Header & footer" }

export default function HeaderFooterPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/website/header-footer"))
  return (
    <GlobalEditor
      title="Header & footer"
      keys={[...SETTINGS_PAGES.navigation, ...SETTINGS_PAGES.footer]}
    />
  )
}

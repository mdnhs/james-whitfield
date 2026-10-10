import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { CodeView } from "@/admin/modules/marketing/code-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"
import { getEnv } from "@/server/env"

export const metadata: Metadata = { title: "Custom code" }

export default function CodePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/marketing/code"))
  return <CodeView disabled={getEnv().DISABLE_CUSTOM_SCRIPTS} />
}

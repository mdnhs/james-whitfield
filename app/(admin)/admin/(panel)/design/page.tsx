import type { Metadata } from "next"
import { Suspense } from "react"

import { Showcase } from "@/admin/modules/design/showcase"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Design system" }

export default function DesignPage() {
  return (
    <Suspense fallback={null}>
      <Design />
    </Suspense>
  )
}

// Owner-only, gated by the same registry entry that lists the link in ⌘K
// and the user menu, so the two cannot drift (docs/brief.md §7.2).
async function Design() {
  await requirePermission(permissionFor("/admin/design"))
  return <Showcase />
}

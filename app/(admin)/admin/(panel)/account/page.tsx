import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { AccountView } from "@/admin/modules/account/account-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Account" }

export default function AccountPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Account />
    </Suspense>
  )
}

// Every user manages their own profile, password and sessions
// (docs/brief.md §7.2). Gated by the registry entry that lists the link
// (every role holds it), so the two cannot drift.
async function Account() {
  await requirePermission(permissionFor("/admin/account"))
  return <AccountView />
}

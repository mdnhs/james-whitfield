import type { Metadata } from "next"
import { io } from "next/cache"
import { Suspense } from "react"

import { DashboardSkeleton } from "@/admin/modules/dashboard/dashboard-skeleton"
import { DashboardView } from "@/admin/modules/dashboard/dashboard-view"
import { firstName, greetingFor } from "@/admin/modules/dashboard/present"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"
import { getEnv } from "@/server/env"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  )
}

// Gated by the registry entry that lists the Dashboard link, so the two
// cannot drift (docs/brief.md §7.2).
async function Dashboard() {
  const actor = await requirePermission(permissionFor("/admin"))
  // The greeting depends on the time of day: request time, never the
  // static shell.
  await io()
  return (
    <DashboardView
      greeting={`${greetingFor(new Date())}, ${firstName(actor.name)}`}
      siteUrl={getEnv().SITE_URL}
    />
  )
}

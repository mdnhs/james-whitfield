import { cookies } from "next/headers"
import { Suspense } from "react"

import { AdminShell } from "@/admin/components/shell/admin-shell"
import { SIDEBAR_COOKIE } from "@/admin/components/shell/constants"
import { AdminActorProvider } from "@/admin/lib/actor-context"
import { AdminQueryProvider } from "@/admin/lib/query-provider"
import { toMePayload } from "@/lib/auth/me"
import { requireActor } from "@/server/auth/session"
import { getEnv } from "@/server/env"

// The session read is request-time data, so it sits behind Suspense (Cache
// Components). requireActor also sends an owner or admin without 2FA to
// setup (docs/brief.md §7.4). This check is for UX; the API authorises, and
// enforces 2FA on, every call itself.
export default function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <Guarded>{children}</Guarded>
    </Suspense>
  )
}

async function Guarded({ children }: { children: React.ReactNode }) {
  const actor = await requireActor()
  // Only an explicit "false" collapses; a first visit starts open.
  const sidebarOpen = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "false"
  return (
    <AdminActorProvider value={toMePayload(actor)}>
      <AdminQueryProvider>
        <AdminShell defaultOpen={sidebarOpen} siteUrl={getEnv().SITE_URL}>
          {children}
        </AdminShell>
      </AdminQueryProvider>
    </AdminActorProvider>
  )
}

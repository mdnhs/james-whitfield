import { Suspense } from "react"

import { AdminActorProvider } from "@/admin/lib/actor-context"
import { AdminQueryProvider } from "@/admin/lib/query-provider"
import { toMePayload } from "@/lib/auth/me"
import { requireActor } from "@/server/auth/session"

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
  return (
    <AdminActorProvider value={toMePayload(actor)}>
      <AdminQueryProvider>
        <div className="min-h-svh bg-background p-3 sm:p-4">{children}</div>
      </AdminQueryProvider>
    </AdminActorProvider>
  )
}

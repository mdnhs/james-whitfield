import { Suspense } from "react"

import { requireActor } from "@/server/auth/session"

// The session read is request-time data, so it sits behind Suspense (Cache
// Components). This check is for UX; the API authorises every call itself.
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
  await requireActor()
  return <div className="min-h-svh bg-background p-3 sm:p-4">{children}</div>
}

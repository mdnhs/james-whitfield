"use client"

import { EyeIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { useActor } from "@/admin/lib/actor-context"
import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"

// docs/brief.md §7.4: View-as "shows a sticky banner". Fixed and centred at
// the bottom so it never fights the sidebar or the topbar (Ruling R9).
export function ViewAsBanner() {
  const { user, roles, impersonatedBy } = useActor()
  const [busy, setBusy] = useState(false)
  if (!impersonatedBy) return null

  async function stop() {
    setBusy(true)
    const { error } = await authClient.admin.stopImpersonating()
    if (error) {
      setBusy(false)
      toast.error("Couldn't stop viewing. Sign out to end it.")
      return
    }
    // A full load drops every cached query from the viewed identity.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full document load on purpose: see above
    window.location.assign("/admin/users")
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-60 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border bg-foreground px-4 py-2 text-sm text-background shadow-lg"
    >
      <EyeIcon aria-hidden className="size-4 shrink-0" />
      <span className="truncate">
        Viewing as {user.name} ({roles.join(", ")})
      </span>
      <Button size="sm" variant="secondary" disabled={busy} onClick={stop}>
        Stop viewing
      </Button>
    </div>
  )
}

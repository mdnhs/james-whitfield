"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/admin/lib/auth-client"
import { getQueryClient } from "@/admin/lib/query-client"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"

// The one sign-out path: the user menu, the sidebar's "Log out", the
// two-factor setup escape hatch and ⌘K all call this.
export function useSignOut() {
  const [pending, setPending] = useState(false)
  useResetOnHide(() => setPending(false))

  const signOut = useCallback(async () => {
    setPending(true)
    let failed = false
    try {
      failed = Boolean((await authClient.signOut()).error)
    } catch {
      failed = true
    }
    if (failed) {
      setPending(false)
      toast.error("Couldn't sign out. Try again.")
      return
    }
    // Nothing of this user may outlive the session in this tab: drop the
    // query cache, then load the sign-in page fresh. A hard navigation also
    // discards the routes Cache Components keeps hidden in <Activity> and
    // all module state, which a client-side replace would keep.
    getQueryClient().clear()
    // Stays pending: the sign-in page replaces this document.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full document load on purpose: see above
    window.location.assign("/admin/sign-in")
  }, [])

  return { signOut, pending }
}

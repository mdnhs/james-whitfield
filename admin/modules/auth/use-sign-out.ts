"use client"

import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/admin/lib/auth-client"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"

// The one sign-out path: the user menu, the sidebar's "Log out", the
// two-factor setup escape hatch and ⌘K all call this.
export function useSignOut() {
  const router = useRouter()
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
    // Stays pending: the sign-in screen replaces this one.
    router.replace("/admin/sign-in")
    router.refresh()
  }, [router])

  return { signOut, pending }
}

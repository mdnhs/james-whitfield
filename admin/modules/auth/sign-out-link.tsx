"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/admin/lib/auth-client"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"

// A way out of a screen that otherwise blocks the panel (two-factor setup).
export function SignOutLink() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  useResetOnHide(() => setPending(false))
  return (
    <p className="text-sm text-muted-foreground">
      Not a good time?{" "}
      <button
        type="button"
        disabled={pending}
        className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        onClick={async () => {
          setPending(true)
          const { error } = await authClient.signOut()
          if (error) {
            setPending(false)
            return toast.error("Couldn't sign out. Try again.")
          }
          router.replace("/admin/sign-in")
          router.refresh()
        }}
      >
        Sign out
      </button>
    </p>
  )
}

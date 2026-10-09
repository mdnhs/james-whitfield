"use client"

import { useSignOut } from "./use-sign-out"

// A way out of a screen that otherwise blocks the panel (two-factor setup).
export function SignOutLink() {
  const { signOut, pending } = useSignOut()
  return (
    <p className="text-sm text-muted-foreground">
      Not a good time?{" "}
      <button
        type="button"
        disabled={pending}
        className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        onClick={signOut}
      >
        Sign out
      </button>
    </p>
  )
}

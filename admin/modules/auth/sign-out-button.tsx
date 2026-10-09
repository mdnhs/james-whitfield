"use client"

import { LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/admin/lib/auth-client"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <Button
      variant="outline"
      disabled={pending}
      className="h-11 rounded-xl border-primary px-4 font-semibold text-primary hover:bg-accent hover:text-accent-foreground"
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
      <LogOutIcon data-icon="inline-start" />
      Sign out
    </Button>
  )
}

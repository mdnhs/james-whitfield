"use client"

import { LogOutIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

import { useSignOut } from "./use-sign-out"

export function SignOutButton() {
  const { signOut, pending } = useSignOut()
  return (
    <Button
      variant="outline"
      disabled={pending}
      className="h-11 rounded-xl border-primary px-4 font-semibold text-primary hover:bg-accent hover:text-accent-foreground"
      onClick={signOut}
    >
      <LogOutIcon data-icon="inline-start" />
      Sign out
    </Button>
  )
}

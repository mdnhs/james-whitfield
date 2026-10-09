"use client"

import { createContext, use } from "react"

import type { MePayload } from "@/lib/auth/me"
import { hasPermission, type Permissions } from "@/lib/auth/permissions"

const ActorContext = createContext<MePayload | null>(null)

export function AdminActorProvider({
  value,
  children,
}: {
  value: MePayload
  children: React.ReactNode
}) {
  return <ActorContext value={value}>{children}</ActorContext>
}

export function useActor(): MePayload {
  const actor = use(ActorContext)
  if (!actor) throw new Error("useActor must be used inside AdminActorProvider")
  return actor
}

// Hides or disables controls. Convenience only, never security: the API and
// requirePermission decide (docs/brief.md §7.3, layer 5).
export function usePermission(permissions: Permissions): boolean {
  return hasPermission(useActor().roles, permissions)
}

import "server-only"

import { hasPermission, type RoleName } from "@/lib/auth/permissions"
import { VIEW_AS_ADMIN_ROLES } from "@/server/auth/view-as-limit"

// docs/brief.md §7.2 invariants that need no database. The last-owner rule
// needs a count, so it lives in manage.ts inside the access lock (R2).
export type ManageAction =
  | "set-role"
  | "ban"
  | "unban"
  | "revoke"
  | "delete"
  | "impersonate"
  | "resend"
  | "link-author"

export type GuardActor = { userId: string; roles: readonly RoleName[] }
export type GuardTarget = { id: string; roles: readonly RoleName[] }

const SELF_ALLOWED: ReadonlySet<ManageAction> = new Set(["link-author"])

export function refusal(
  actor: GuardActor,
  target: GuardTarget,
  action: ManageAction,
  nextRoles?: readonly RoleName[]
): string | null {
  if (actor.userId === target.id && !SELF_ALLOWED.has(action)) {
    return action === "set-role"
      ? "You can't change your own role"
      : "Manage your own account from the Account page"
  }
  const actorIsOwner = actor.roles.includes("owner")
  if (target.roles.includes("owner") && !actorIsOwner)
    return "Only an owner can manage another owner"
  if (nextRoles?.includes("owner") && !actorIsOwner)
    return "Only an owner can grant the owner role"
  return null
}

export function losesOwner(
  target: GuardTarget,
  action: ManageAction,
  nextRoles?: readonly RoleName[]
) {
  if (!target.roles.includes("owner")) return false
  if (action === "ban" || action === "delete") return true
  return action === "set-role" && !nextRoles?.includes("owner")
}

// May `actor` view as `target`? Checked when a View-as starts and again on
// every request of that session, so a later role change or promotion of the
// target ends it (final review I1).
export function viewAsRefusal(
  actor: GuardActor,
  target: GuardTarget
): string | null {
  const why = refusal(actor, target, "impersonate")
  if (why) return why
  if (!hasPermission(actor.roles, { user: ["impersonate"] }))
    return "You can't view as this person"
  if (
    target.roles.some((role) =>
      (VIEW_AS_ADMIN_ROLES as readonly RoleName[]).includes(role)
    ) &&
    !hasPermission(actor.roles, { user: ["impersonate-admins"] })
  )
    return "You can't view as this person"
  return null
}

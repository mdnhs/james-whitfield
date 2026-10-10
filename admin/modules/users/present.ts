import type { StatusTone } from "@/admin/components/dashboard/status-pill"
import type { MePayload } from "@/lib/auth/me"
import { hasPermission, type Permissions } from "@/lib/auth/permissions"
import type { UserDto } from "@/server/modules/users/manage"

const DAY = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Dublin",
})

export function userStatus(
  user: UserDto,
  now = new Date()
): { label: string; tone: StatusTone } {
  const banEnd = user.banExpires ? new Date(user.banExpires) : null
  if (user.banned && (!banEnd || banEnd > now)) {
    return {
      label: banEnd ? `Banned until ${DAY.format(banEnd)}` : "Banned",
      tone: "danger",
    }
  }
  if (user.invitePending) return { label: "Invite pending", tone: "info" }
  return { label: "Active", tone: "success" }
}

export function isBanned(user: UserDto, now = new Date()) {
  const banEnd = user.banExpires ? new Date(user.banExpires) : null
  return user.banned && (!banEnd || banEnd > now)
}

export type UserAction =
  | "roles"
  | "author"
  | "ban"
  | "unban"
  | "revoke"
  | "resend"
  | "view-as"
  | "delete"

// Mirrors server/modules/users/guard.ts so the menu only offers what the API
// will accept. A convenience: the API still decides (docs/brief.md §7.3).
export function availableActions(
  actor: MePayload,
  target: UserDto,
  now = new Date()
): UserAction[] {
  if (actor.impersonatedBy || actor.user.id === target.id) return []
  const actorIsOwner = actor.roles.includes("owner")
  if (target.roles.includes("owner") && !actorIsOwner) return []
  const allowed = (permissions: Permissions) =>
    hasPermission(actor.roles, permissions)
  const banned = isBanned(target, now)
  const needsAdminView = target.roles.some(
    (role) => role === "owner" || role === "admin"
  )
  const actions: UserAction[] = []
  if (allowed({ user: ["set-role"] })) actions.push("roles")
  if (allowed({ user: ["update"] })) actions.push("author")
  if (target.invitePending && allowed({ user: ["create"] }))
    actions.push("resend")
  if (
    allowed({ user: ["impersonate"] }) &&
    !banned &&
    (!needsAdminView || allowed({ user: ["impersonate-admins"] }))
  )
    actions.push("view-as")
  if (allowed({ user: ["ban"] })) actions.push(banned ? "unban" : "ban")
  if (allowed({ session: ["revoke"] })) actions.push("revoke")
  if (allowed({ user: ["delete"] })) actions.push("delete")
  return actions
}

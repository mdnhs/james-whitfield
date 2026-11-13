"use client"

import {
  BanIcon,
  CircleCheckIcon,
  ClockIcon,
  CrownIcon,
  EyeIcon,
  FeatherIcon,
  InboxIcon,
  LinkIcon,
  LogOutIcon,
  MegaphoneIcon,
  MoreHorizontalIcon,
  PenLineIcon,
  SendIcon,
  ShieldCheckIcon,
  ShieldIcon,
  ShieldOffIcon,
  Trash2Icon,
  UserCogIcon,
  type LucideIcon,
} from "lucide-react"

import { TipButton } from "@/admin/components/actions/tip-button"
import { IconPill } from "@/admin/components/dashboard/icon-pill"
import { useActor } from "@/admin/lib/actor-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { RoleName } from "@/lib/auth/permissions"
import { ROLE_LABELS } from "@/lib/auth/role-labels"
import type { UserDto } from "@/server/modules/users/manage"

import { formatWhen } from "@/admin/modules/leads/present"
import { availableActions, userStatus, type UserAction } from "./present"

const LABELS: Record<UserAction, string> = {
  roles: "Change roles",
  author: "Link author profile",
  resend: "Resend invite",
  "view-as": "View as this person",
  ban: "Ban",
  unban: "Unban",
  revoke: "Sign out everywhere",
  delete: "Delete",
}
const ACTION_ICONS: Record<UserAction, LucideIcon> = {
  roles: UserCogIcon,
  author: LinkIcon,
  resend: SendIcon,
  "view-as": EyeIcon,
  ban: BanIcon,
  unban: CircleCheckIcon,
  revoke: LogOutIcon,
  delete: Trash2Icon,
}
const ROLE_ICONS: Record<RoleName, LucideIcon> = {
  owner: CrownIcon,
  admin: ShieldCheckIcon,
  editor: PenLineIcon,
  author: FeatherIcon,
  marketer: MegaphoneIcon,
  intake: InboxIcon,
  viewer: EyeIcon,
}
const STATUS_ICONS = {
  success: CircleCheckIcon,
  info: ClockIcon,
  danger: BanIcon,
} as Record<string, LucideIcon>
function ActionIcon({ action }: { action: UserAction }) {
  const Icon = ACTION_ICONS[action]
  return <Icon aria-hidden />
}

// Shown as icons before the overflow menu (which still lists everything).
const INLINE: UserAction[] = ["roles", "resend"]
const DESTRUCTIVE = new Set<UserAction>(["ban", "revoke", "delete"])

// One list for every width: a row wraps into a card on narrow screens.
export function UsersTable({
  users,
  onAction,
}: {
  users: UserDto[]
  onAction(action: UserAction, user: UserDto): void
}) {
  const actor = useActor()
  return (
    <ul role="list" aria-label="People" className="flex flex-col gap-3">
      {users.map((user) => {
        const status = userStatus(user)
        const actions = availableActions(actor, user)
        const isYou = user.id === actor.user.id
        return (
          <li
            key={user.id}
            className="rounded-card flex flex-wrap items-center gap-x-6 gap-y-3 bg-card p-4"
          >
            <div className="flex min-w-0 flex-1 basis-56 flex-col">
              <span className="truncate font-semibold">
                {user.name}
                {isYou ? (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    (you)
                  </span>
                ) : null}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {user.email}
              </span>
              {user.author ? (
                <span className="truncate text-xs text-muted-foreground">
                  Author: {user.author.name}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {user.roles.map((role) => (
                <IconPill
                  key={role}
                  tone="neutral"
                  icon={ROLE_ICONS[role] ?? ShieldIcon}
                >
                  {ROLE_LABELS[role]}
                </IconPill>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <IconPill
                tone={status.tone}
                icon={STATUS_ICONS[status.tone] ?? CircleCheckIcon}
              >
                {status.label}
              </IconPill>
              <IconPill
                tone={user.twoFactorEnabled ? "success" : "warning"}
                icon={user.twoFactorEnabled ? ShieldCheckIcon : ShieldOffIcon}
              >
                {user.twoFactorEnabled ? "2FA on" : "2FA off"}
              </IconPill>
              <span className="text-xs text-muted-foreground">
                {user.lastActiveAt
                  ? `Active ${formatWhen(user.lastActiveAt)}`
                  : "Never active"}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {actions
                .filter((action) => INLINE.includes(action))
                .map((action) => (
                  <TipButton
                    key={action}
                    label={
                      action === "resend"
                        ? `Resend invite to ${user.name}`
                        : `Change roles for ${user.name}`
                    }
                    icon={ACTION_ICONS[action]}
                    size="icon"
                    onClick={() => onAction(action, user)}
                  />
                ))}
              {actions.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${user.name}`}
                      />
                    }
                  >
                    <MoreHorizontalIcon aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {actions.map((action) => (
                      <div key={action}>
                        {action === "ban" || action === "unban" ? (
                          <DropdownMenuSeparator />
                        ) : null}
                        <DropdownMenuItem
                          variant={
                            DESTRUCTIVE.has(action) ? "destructive" : "default"
                          }
                          onClick={() => onAction(action, user)}
                        >
                          <ActionIcon action={action} />
                          {LABELS[action]}
                        </DropdownMenuItem>
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

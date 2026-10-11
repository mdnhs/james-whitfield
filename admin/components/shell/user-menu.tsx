"use client"

import {
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  ShieldCheckIcon,
  SunIcon,
  UserIcon,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"

import { useActor } from "@/admin/lib/actor-context"
import { initials } from "@/admin/lib/initials"
import { useSignOut } from "@/admin/modules/auth/use-sign-out"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const

// The avatar alone in the topbar; name, email and role badge sit in the
// menu it opens (docs/brief.md §9.1). The aria-label names the button, so
// the initials are hidden from assistive tech.
export function UserMenu() {
  const { user, roles } = useActor()
  const { theme, setTheme } = useTheme()
  const { signOut, pending } = useSignOut()
  const roleLabel = roles.join(", ")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        className="flex shrink-0 rounded-full p-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar aria-hidden className="size-11">
          <AvatarFallback className="bg-primary font-semibold text-primary-foreground">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="truncate font-semibold text-foreground">
              {user.name}
            </span>
            <span className="truncate text-xs font-normal">{user.email}</span>
            {roleLabel ? (
              <Badge variant="secondary" className="mt-2 capitalize">
                {roleLabel}
              </Badge>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/admin/account" />}>
            <UserIcon />
            Account
          </DropdownMenuItem>
          <DropdownMenuItem
            render={<Link href="/admin/account?tab=security" />}
          >
            <ShieldCheckIcon />
            Security
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme ?? "system"}
            onValueChange={(value) => setTheme(String(value))}
          >
            {THEMES.map(({ value, label, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={pending} onClick={signOut}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

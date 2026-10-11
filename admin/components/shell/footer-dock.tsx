"use client"

import { LogOutIcon } from "lucide-react"
import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { isActivePath, type NavLink } from "@/lib/admin/nav"
import { cn } from "@/lib/utils"

import { NAV_ICONS } from "./nav-icons"

// One square icon button; a tooltip shows its name, the aria-label carries it.
// "card" sits on the website card's dark gradient, "rail" on the sidebar.
const DOCK_BUTTON = {
  card: "text-current opacity-80 hover:bg-white/10 hover:opacity-100 aria-[current=page]:bg-white/15 aria-[current=page]:opacity-100",
  rail: "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-primary",
}

export type DockProps = {
  links: readonly NavLink[]
  pathname: string
  onNavigate: () => void
  onSignOut: () => void
  signingOut: boolean
}

// Users & roles, Activity log, Help and Log out as icon buttons: a row inside
// the website card, or a column in the icon rail where the card is hidden.
export function FooterDock({
  tone,
  links,
  pathname,
  onNavigate,
  onSignOut,
  signingOut,
}: DockProps & { tone: "card" | "rail" }) {
  const button = cn(
    buttonVariants({ variant: "ghost", size: "icon-lg" }),
    "rounded-lg [&_svg]:size-5",
    DOCK_BUTTON[tone]
  )
  return (
    <nav aria-label="Account">
      <ul
        className={cn(
          "flex items-center gap-1",
          tone === "card" ? "justify-between" : "flex-col"
        )}
      >
        {links.map((link) => {
          const Icon = NAV_ICONS[link.id]
          const active = isActivePath(pathname, link.href)
          return (
            <li key={link.id}>
              <DockTip label={link.label}>
                <Link
                  href={link.href}
                  onClick={onNavigate}
                  aria-label={link.label}
                  aria-current={active ? "page" : undefined}
                  className={button}
                >
                  {Icon ? <Icon /> : null}
                </Link>
              </DockTip>
            </li>
          )
        })}
        <li>
          <DockTip label="Log out">
            <button
              type="button"
              aria-label="Log out"
              disabled={signingOut}
              onClick={onSignOut}
              className={button}
            >
              <LogOutIcon />
            </button>
          </DockTip>
        </li>
      </ul>
    </nav>
  )
}

function DockTip({
  label,
  children,
}: {
  label: string
  children: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

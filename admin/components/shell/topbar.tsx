"use client"

import { MailIcon } from "lucide-react"
import Link from "next/link"

import { SearchPill } from "@/admin/components/command/search-pill"
import { usePermission } from "@/admin/lib/actor-context"
import { buttonVariants } from "@/components/ui/button"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { ICON_BUTTON } from "./constants"
import { NotificationsButton } from "./notifications-button"
import { UserMenu } from "./user-menu"

// The 72px topbar panel (docs/brief.md §9.1–9.2).
export function Topbar() {
  const canReadLeads = usePermission({ lead: ["read"] })
  return (
    <header className="rounded-card flex h-[72px] shrink-0 items-center gap-2 bg-sidebar px-3 sm:gap-3 sm:px-5">
      <SidebarTrigger
        aria-label="Toggle navigation"
        className="size-10 rounded-full"
      />
      <div className="flex min-w-0 flex-1" data-slot="topbar-search">
        <SearchPill />
      </div>
      {canReadLeads ? (
        // A real link (role "link"), styled as an icon button.
        <Link
          href="/admin/leads"
          aria-label="Enquiries"
          data-slot="button"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon-lg" }),
            ICON_BUTTON
          )}
        >
          <MailIcon />
        </Link>
      ) : null}
      <NotificationsButton />
      <UserMenu />
    </header>
  )
}

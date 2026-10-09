"use client"

import { LogOutIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { BrandMark } from "@/admin/components/brand-mark"
import { useActor } from "@/admin/lib/actor-context"
import { useSignOut } from "@/admin/modules/auth/use-sign-out"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  HELP_LINK,
  isActivePath,
  NAV_GROUPS,
  visibleNav,
} from "@/lib/admin/nav"

import { NAV_BUTTON, NavEntry } from "./nav-entry"
import { NAV_ICONS } from "./nav-icons"
import { WebsiteCard } from "./website-card"

export function AppSidebar({
  siteUrl,
  badges = {},
}: {
  siteUrl: string
  badges?: Partial<Record<"new-leads", number>>
}) {
  const { roles } = useActor()
  const pathname = usePathname()
  const { signOut, pending } = useSignOut()
  const { isMobile, setOpenMobile } = useSidebar()
  const items = visibleNav(roles)
  // Following a link inside the mobile sheet closes it (Review Focus #5).
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }
  const HelpIcon = NAV_ICONS.help

  return (
    <Sidebar variant="floating" collapsible="icon" className="p-4">
      <SidebarHeader className="px-4 pt-5 pb-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1">
        <Link
          href="/admin"
          onClick={onNavigate}
          aria-label="Magda Kennedy admin home"
          className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark className="group-data-[collapsible=icon]:[&>span:last-child]:hidden" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <nav aria-label="Main">
          {NAV_GROUPS.map((group) => {
            const inGroup = items.filter((item) => item.group === group.id)
            if (inGroup.length === 0) return null
            return (
              <SidebarGroup key={group.id} className="py-1">
                <SidebarGroupLabel className="h-7 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarMenu className="gap-0.5">
                  {inGroup.map((item) => (
                    <NavEntry
                      key={item.id}
                      item={item}
                      pathname={pathname}
                      badge={item.badge ? badges[item.badge] : undefined}
                      onNavigate={onNavigate}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            )
          })}
        </nav>
        <nav aria-label="Account" className="mt-auto">
          <SidebarGroup className="py-1">
            <SidebarMenu className="gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  tooltip={HELP_LINK.label}
                  isActive={isActivePath(pathname, HELP_LINK.href)}
                  className={NAV_BUTTON}
                  render={<Link href={HELP_LINK.href} onClick={onNavigate} />}
                >
                  <HelpIcon />
                  <span>{HELP_LINK.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  tooltip="Log out"
                  disabled={pending}
                  className={NAV_BUTTON}
                  onClick={signOut}
                >
                  <LogOutIcon />
                  <span>Log out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </nav>
        {/* Scrolls with the menu, so a tall menu is never hidden under it. */}
        <div className="p-3 pt-2">
          <WebsiteCard siteUrl={siteUrl} />
        </div>
      </SidebarContent>
    </Sidebar>
  )
}

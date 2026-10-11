"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { BrandMark } from "@/admin/components/brand-mark"
import { useActor } from "@/admin/lib/actor-context"
import { useSignOut } from "@/admin/modules/auth/use-sign-out"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar"
import { HELP_LINK, NAV_GROUPS, visibleNav } from "@/lib/admin/nav"

import { type DockProps, FooterDock } from "./footer-dock"
import { NavEntry } from "./nav-entry"
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
  const visible = visibleNav(roles)
  const items = visible.filter((item) => !item.dock)
  // Following a link inside the mobile sheet closes it (Review Focus #5).
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false)
  }
  const dockProps: DockProps = {
    links: [...visible.filter((item) => item.dock), HELP_LINK],
    pathname,
    onNavigate,
    onSignOut: signOut,
    signingOut: pending,
  }

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
      </SidebarContent>
      {/* Pinned below the scrolling menu, so it always stays in view. The
          card (and the dock row in it) hides in the icon rail, where the
          dock stands alone as a column. */}
      <SidebarFooter className="p-3 pt-2 group-data-[collapsible=icon]:px-1">
        <WebsiteCard siteUrl={siteUrl}>
          <FooterDock tone="card" {...dockProps} />
        </WebsiteCard>
        <div className="hidden group-data-[collapsible=icon]:block">
          <FooterDock tone="rail" {...dockProps} />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

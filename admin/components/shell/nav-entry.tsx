"use client"

import Link from "next/link"

import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { isActivePath, type NavItem } from "@/lib/admin/nav"

import { formatBadge } from "./format-badge"
import { NAV_ICONS } from "./nav-icons"

// Muted label and icon; the active item gets a bold label and a filled
// green icon (docs/brief.md §9.2, signature component 1). In the icon rail
// the label turns sr-only: out of the layout, still the link's name.
export const NAV_BUTTON =
  "h-10 gap-3 rounded-xl px-3 text-[15px] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span]:sr-only text-muted-foreground hover:bg-sidebar-accent/60 data-active:bg-transparent data-active:font-semibold data-active:text-foreground [&_svg]:size-5 data-active:[&_svg]:fill-primary/15 data-active:[&_svg]:text-primary"

export function NavEntry({
  item,
  pathname,
  badge,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  badge?: number
  onNavigate: () => void
}) {
  const Icon = NAV_ICONS[item.id]
  const active = isActivePath(pathname, item.href)
  const children = item.children ?? []
  return (
    <SidebarMenuItem>
      {/* The 4px active bar on the panel's left edge (the group's p-2 away). */}
      {active ? (
        <span
          aria-hidden
          className="absolute top-1/2 -left-2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary"
        />
      ) : null}
      <SidebarMenuButton
        size="lg"
        isActive={active}
        tooltip={item.label}
        className={NAV_BUTTON}
        render={
          <Link
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
          />
        }
      >
        {Icon ? <Icon /> : null}
        <span>{item.label}</span>
      </SidebarMenuButton>
      {badge ? (
        <SidebarMenuBadge className="top-3! right-2 h-6 rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground">
          {formatBadge(badge)}
        </SidebarMenuBadge>
      ) : null}
      {active && children.length > 1 ? (
        <SidebarMenuSub className="mt-1">
          {children.map((child) => {
            const current = pathname === child.href
            return (
              <SidebarMenuSubItem key={child.id}>
                <SidebarMenuSubButton
                  isActive={current}
                  className="h-8"
                  render={
                    <Link
                      href={child.href}
                      onClick={onNavigate}
                      aria-current={current ? "page" : undefined}
                    />
                  }
                >
                  <span>{child.label}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

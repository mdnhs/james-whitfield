"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useActor } from "@/admin/lib/actor-context"
import {
  isActivePath,
  isActiveSection,
  visibleNav,
  type NavLink,
} from "@/lib/admin/nav"
import { cn } from "@/lib/utils"

// A section's sub-pages (Website, SEO, Marketing, Site
// settings) as vertical tabs inside the content panel, so the sidebar lists
// sections only. Below 1024px the tabs become a scrolling row above the page.
export function SectionTabs({ children }: { children: React.ReactNode }) {
  const { roles } = useActor()
  const pathname = usePathname()
  const section = visibleNav(roles).find(
    (item) =>
      (item.children?.length ?? 0) > 1 && isActiveSection(pathname, item)
  )
  if (!section?.children) return children

  const current = currentTab(section.children, pathname)
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <nav
        aria-label={section.label}
        className="-mx-1 shrink-0 overflow-x-auto lg:mx-0 lg:w-52 lg:overflow-visible"
      >
        <p className="mb-2 hidden px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase lg:block">
          {section.label}
        </p>
        <ul className="flex gap-1 px-1 lg:flex-col lg:px-0">
          {section.children.map((tab) => {
            const active = tab.id === current?.id
            return (
              <li key={tab.id} className="relative shrink-0">
                {active ? (
                  <span
                    aria-hidden
                    className="absolute top-1/2 left-0 hidden h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary lg:block"
                  />
                ) : null}
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center rounded-md px-3 text-sm whitespace-nowrap text-muted-foreground outline-none hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                    active && "bg-sidebar-accent font-semibold text-foreground"
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

// The deepest tab whose href covers the path: /admin/insights/categories is
// Categories, while an article's /admin/insights/<id> falls back to Articles.
function currentTab(tabs: readonly NavLink[], pathname: string) {
  const reach = (tab: NavLink) =>
    Math.max(
      ...[tab.href, ...(tab.match ?? [])]
        .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
        .map((prefix) => prefix.length)
    )
  return tabs
    .filter((tab) => isActivePath(pathname, tab))
    .sort((a, b) => reach(b) - reach(a))[0]
}

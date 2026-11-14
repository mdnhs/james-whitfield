"use client"

import { motion } from "motion/react"
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

import { PageTransition } from "../motion/page-transition"
import { SUBNAV_ICONS } from "./nav-icons"

const SLIDE = { duration: 0.22, ease: "easeOut" } as const

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
  if (!section?.children) return <PageTransition>{children}</PageTransition>

  const current = currentTab(section.children, pathname)
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      <nav
        aria-label={section.label}
        className="-mx-1 shrink-0 overflow-x-auto lg:sticky lg:top-0 lg:mx-0 lg:max-h-[var(--content-h)] lg:w-52 lg:self-start lg:overflow-y-auto"
      >
        <p className="mb-2 hidden px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase lg:block">
          {section.label}
        </p>
        <ul className="flex gap-1 px-1 lg:flex-col lg:px-0">
          {section.children.map((tab) => {
            const active = tab.id === current?.id
            const Icon = SUBNAV_ICONS[tab.id]
            return (
              <li key={tab.id} className="relative shrink-0">
                {/* One highlight and bar slide between tabs (shared layoutId)
                    instead of each tab swapping its own background. */}
                {active ? (
                  <>
                    <motion.span
                      aria-hidden
                      layoutId={`section-tab-bg-${section.id}`}
                      className="absolute inset-0 rounded-md bg-sidebar-accent"
                      transition={SLIDE}
                    />
                    <motion.span
                      aria-hidden
                      layoutId={`section-tab-bar-${section.id}`}
                      className="absolute top-1.5 bottom-1.5 left-0 hidden w-1 rounded-r-full bg-primary lg:block"
                      transition={SLIDE}
                    />
                  </>
                ) : null}
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-9 items-center gap-2.5 rounded-md px-3 text-sm whitespace-nowrap text-muted-foreground outline-none hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                    active && "font-semibold text-foreground"
                  )}
                >
                  {Icon ? (
                    <Icon
                      aria-hidden
                      className={cn(
                        "size-4 shrink-0",
                        active && "text-primary"
                      )}
                    />
                  ) : null}
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <PageTransition>{children}</PageTransition>
      </div>
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

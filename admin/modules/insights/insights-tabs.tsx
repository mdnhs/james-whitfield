"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const TABS = [
  { label: "Articles", href: "/admin/insights" },
  { label: "Categories", href: "/admin/insights/categories" },
  { label: "Authors", href: "/admin/insights/authors" },
  { label: "Page sections", href: "/admin/website/insights" },
] as const

// The Insights screens share one row: the article lists, then the page that
// holds the Insights landing page's own sections.
export function InsightsTabs() {
  const pathname = usePathname()
  const activeHref = (
    TABS.filter(
      (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
    ).sort((a, b) => b.href.length - a.href.length)[0] ?? TABS[0]
  ).href
  return (
    <nav aria-label="Insights" className="overflow-x-auto">
      <ul className="flex gap-1">
        {TABS.map((tab) => {
          const active = tab.href === activeHref
          return (
            <li key={tab.href} className="shrink-0">
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
  )
}

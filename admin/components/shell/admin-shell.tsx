"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"

import { AppSidebar } from "./app-sidebar"
import { Topbar } from "./topbar"

// Floating panels on the canvas with 16px gutters: a 288px sidebar panel
// (20rem minus the container's p-4), the 72px topbar and the content panel
// (docs/brief.md §9.2).
export function AdminShell({
  defaultOpen,
  siteUrl,
  children,
}: {
  defaultOpen: boolean
  siteUrl: string
  children: React.ReactNode
}) {
  return (
    <TooltipProvider>
      <SidebarProvider
        defaultOpen={defaultOpen}
        style={{ "--sidebar-width": "20rem" } as React.CSSProperties}
      >
        <a
          href="#main"
          className="sr-only z-50 rounded-xl bg-card px-4 py-2 text-sm font-semibold shadow-lg focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Skip to content
        </a>
        <AppSidebar siteUrl={siteUrl} />
        <div className="flex min-h-svh min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 lg:pl-0">
          <Topbar />
          <main
            id="main"
            tabIndex={-1}
            className="rounded-card flex-1 bg-sidebar p-4 outline-none sm:p-6 lg:p-8"
          >
            {children}
          </main>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}

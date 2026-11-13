"use client"

import { MenuIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import { HelpSidebar, type HelpNavGroup } from "./help-sidebar"

// Below lg the docs sidebar folds into a drawer, opened from a "Menu"
// button above the article. A link closes it, so its article is in view.
export function HelpMobileNav({
  groups,
  active,
}: {
  groups: readonly HelpNavGroup[]
  active: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="lg:hidden">
      <Button
        variant="outline"
        className="h-10 gap-2 rounded-xl"
        onClick={() => setOpen(true)}
      >
        <MenuIcon aria-hidden />
        Menu
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-80 max-w-[85vw]">
          <SheetHeader>
            <SheetTitle>Help topics</SheetTitle>
            <SheetDescription>
              Guides for every part of the admin.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            <HelpSidebar
              groups={groups}
              active={active}
              onNavigate={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

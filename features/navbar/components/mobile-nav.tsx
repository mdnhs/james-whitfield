"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { GlobalValue } from "@/lib/content/globals"
import { BookCallButton } from "./book-call-button"

type Navigation = GlobalValue<"navigation">

export function MobileNav({
  links,
  cta,
}: {
  links: Navigation["links"]
  cta: Navigation["cta"]
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="flex size-11 items-center justify-center rounded-full border border-white/40 text-white lg:hidden"
      >
        <Menu className="size-5" />
      </SheetTrigger>

      <SheetContent
        side="right"
        showCloseButton={false}
        // Above the fixed header (z-60).
        overlayClassName="z-70 bg-black/40"
        className="z-70 w-[min(20rem,85vw)] gap-0 border-white/15 bg-pine p-6 text-cream"
      >
        <div className="flex items-center justify-between">
          <SheetTitle className="font-plex-mono text-xs font-semibold tracking-wide text-mist uppercase">
            Menu
          </SheetTitle>
          <SheetClose
            aria-label="Close menu"
            className="flex size-11 items-center justify-center rounded-full border border-white/40 text-white"
          >
            <X className="size-5" />
          </SheetClose>
        </div>

        <nav aria-label="Mobile" className="mt-8 flex flex-col gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-full px-4 py-3 text-lg text-cream transition-colors hover:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <BookCallButton
          cta={cta}
          location="mobile-nav"
          className="mt-auto w-full justify-between"
        />
      </SheetContent>
    </Sheet>
  )
}

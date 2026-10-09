"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

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
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="flex size-11 items-center justify-center rounded-full border border-white/40 text-white"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {open && (
        <nav
          id="mobile-nav"
          className="absolute inset-x-4 top-full mt-2 flex flex-col gap-1 rounded-3xl border border-white/15 bg-black/60 p-4 backdrop-blur-md"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-full px-4 py-2 text-base text-white hover:bg-white/10"
            >
              {link.label}
            </Link>
          ))}
          <BookCallButton cta={cta} className="mt-2 self-start sm:hidden" />
        </nav>
      )}
    </div>
  )
}

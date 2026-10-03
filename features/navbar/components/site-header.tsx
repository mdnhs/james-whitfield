import Link from "next/link"

import { cn } from "@/lib/utils"
import { NAV_LINKS } from "../data/nav-links"
import { BookCallButton } from "./book-call-button"
import { Brand } from "./brand"
import { MobileNav } from "./mobile-nav"

export function SiteHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "relative z-20 w-full bg-[url(/images/hero/navbar-bg.png)] bg-size-[100%_100%]",
        className
      )}
    >
      <div className="mx-auto flex h-25 w-full max-w-360 items-center justify-between px-4 sm:px-6 lg:px-16.5">
        <Brand />

        <nav aria-label="Main" className="hidden items-center gap-5.5 lg:flex">
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "py-2 text-base leading-6 whitespace-nowrap text-white transition-opacity hover:opacity-70",
                i === 0 ? "font-medium" : "font-normal"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <BookCallButton className="hidden sm:inline-flex" />
          <MobileNav />
        </div>
      </div>
    </header>
  )
}

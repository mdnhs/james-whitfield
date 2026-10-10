import Link from "next/link"

import { Brand } from "@/components/brand"
import { Container } from "@/components/layout/container"
import type { GlobalValue } from "@/lib/content/globals"
import type { MediaAsset } from "@/lib/media"
import { cn } from "@/lib/utils"
import { BookCallButton } from "./book-call-button"
import { HeaderScroll } from "./header-scroll"
import { MobileNav } from "./mobile-nav"

export function SiteHeader({
  site,
  navigation,
  logo,
  className,
}: {
  site: { name: string }
  logo?: MediaAsset | null
  navigation: GlobalValue<"navigation">
  className?: string
}) {
  return (
    <HeaderScroll>
      <header
        data-site-chrome
        className={cn(
          "relative z-20 w-full bg-[url(/images/hero/navbar-bg.png)] bg-size-[100%_100%] group-data-scrolled/header:bg-none",
          className
        )}
      >
        <Container className="flex h-25 items-center justify-between transition-[height] duration-500 ease-out group-data-scrolled/header:h-18">
          <Brand name={site.name} logo={logo} />

          <nav
            aria-label="Main"
            className="hidden items-center gap-5.5 lg:flex"
          >
            {navigation.links.map((link, i) => (
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
            <BookCallButton
              cta={navigation.cta}
              location="header"
              className="hidden sm:inline-flex"
            />
            <MobileNav links={navigation.links} cta={navigation.cta} />
          </div>
        </Container>
      </header>
    </HeaderScroll>
  )
}

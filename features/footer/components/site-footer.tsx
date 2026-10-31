import Link from "next/link"

import { Brand } from "@/components/brand"
import { Container } from "@/components/layout/container"
import { CopyrightYear } from "@/components/copyright-year"
import type { GlobalValue } from "@/lib/content/globals"
import type { MediaAsset } from "@/lib/media"

import { CookieSettingsButton } from "./cookie-settings-button"

// Clay itself is 1.9:1 on pine; lifted toward white it reads as clay and
// clears 4.5:1 (axe, Phase 11).
const columnTitle =
  "font-plex-mono text-xs leading-[normal] font-semibold text-[color-mix(in_srgb,var(--color-clay),white_55%)] uppercase"
const linkClass =
  "text-sm leading-[normal] text-cream transition-opacity hover:opacity-70"

export function SiteFooter({
  site,
  footer,
  navigation,
  logo,
  cookieSettings,
}: {
  site: { name: string }
  logo?: MediaAsset | null
  footer: GlobalValue<"footer">
  navigation: GlobalValue<"navigation">
  cookieSettings: string | null
}) {
  return (
    <footer
      id="contact"
      data-site-chrome
      className="bg-pine pt-16 pb-12 lg:pt-24"
    >
      <Container className="flex flex-col gap-12 lg:gap-16">
        <div
          data-motion="stagger"
          className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="flex max-w-100 flex-col items-start gap-5">
            <Brand name={site.name} logo={logo} />
            <p className="text-[15px] leading-[1.6] text-mist">
              {footer.blurb}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-12 sm:flex sm:gap-20">
            {footer.columns.map((column, i) => (
              <nav key={i} aria-label={column.title}>
                <h2 className={columnTitle}>{column.title}</h2>
                <ul className="mt-4 flex flex-col gap-4 text-sm leading-[normal] whitespace-nowrap">
                  {(column.source === "navigation"
                    ? [...column.links, ...navigation.links]
                    : column.links
                  ).map((link, j) => (
                    <li key={j}>
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <div className="sm:w-60">
              <h2 className={columnTitle}>Contact</h2>
              <address className="mt-4 flex flex-col gap-4 not-italic">
                {footer.contactLines.map((line, i) => (
                  <span key={i} className="text-sm leading-[normal] text-cream">
                    {line}
                  </span>
                ))}
                <span className="text-[13px] leading-normal text-mist">
                  {footer.contactNote}
                </span>
              </address>
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className="h-px w-full bg-[url(/images/footer/divider.svg)] bg-size-[100%_100%]"
        />

        <div className="flex flex-col-reverse gap-4 text-xs leading-[normal] text-mist sm:flex-row sm:items-center sm:justify-between">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3 leading-[normal] sm:flex sm:gap-6">
            {footer.legalLinks.map((link, i) => (
              <li key={i}>
                <Link
                  href={link.href}
                  className="transition-opacity hover:opacity-70"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {cookieSettings ? (
              <li>
                <CookieSettingsButton label={cookieSettings} />
              </li>
            ) : null}
          </ul>
          <div className="grid grid-cols-2 items-center gap-6 sm:flex">
            <Link
              href="/admin/sign-in"
              className="transition-opacity hover:opacity-70"
            >
              Login
            </Link>
            <p className="font-plex-mono">
              © <CopyrightYear /> {footer.copyrightName}
            </p>
          </div>
        </div>
      </Container>
    </footer>
  )
}

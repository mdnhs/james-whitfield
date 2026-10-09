import Link from "next/link"

import { Brand } from "@/components/brand"
import { Container } from "@/components/layout/container"
import {
  FOOTER_BLURB,
  FOOTER_COLUMNS,
  FOOTER_CONTACT,
  LEGAL_LINKS,
} from "../data/footer-links"

const columnTitle =
  "font-plex-mono text-xs leading-[normal] font-semibold text-clay uppercase"
const linkClass =
  "text-sm leading-[normal] text-cream transition-opacity hover:opacity-70"

export function SiteFooter() {
  return (
    <footer id="contact" data-site-chrome className="bg-pine pt-16 pb-12 lg:pt-24">
      <Container className="flex flex-col gap-12 lg:gap-16">
        <div
          data-motion="stagger"
          className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="flex max-w-100 flex-col items-start gap-5">
            <Brand />
            <p className="text-[15px] leading-[1.6] text-mist">
              {FOOTER_BLURB}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-12 sm:flex sm:gap-20">
            {FOOTER_COLUMNS.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className={columnTitle}>{column.title}</h2>
                <ul className="mt-4 flex flex-col gap-4 text-sm leading-[normal] whitespace-nowrap">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <div className="col-span-2 sm:w-60">
              <h2 className={columnTitle}>Contact</h2>
              <address className="mt-4 flex flex-col gap-4 not-italic">
                {FOOTER_CONTACT.lines.map((line) => (
                  <span
                    key={line}
                    className="text-sm leading-[normal] text-cream"
                  >
                    {line}
                  </span>
                ))}
                <span className="text-[13px] leading-normal text-mist">
                  {FOOTER_CONTACT.note}
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
          <ul className="flex gap-6 leading-[normal]">
            {LEGAL_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="transition-opacity hover:opacity-70"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="font-plex-mono">
            © {new Date().getFullYear()} Magda Kennedy
          </p>
        </div>
      </Container>
    </footer>
  )
}

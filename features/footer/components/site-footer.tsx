import { Mail, MapPin, Phone } from "lucide-react"
import Link from "next/link"

import { Brand } from "@/components/brand"
import { Container } from "@/components/layout/container"
import { CopyrightYear } from "@/components/copyright-year"
import type { GlobalValue } from "@/lib/content/globals"
import type { MediaAsset } from "@/lib/media"

import { CookieSettingsButton } from "./cookie-settings-button"
import { SOCIAL_NAMES, SocialIcon } from "./social-icons"

// Clay itself is 1.9:1 on pine; lifted toward white it reads as clay and
// clears 4.5:1 (axe, Phase 11).
const columnTitle =
  "font-plex-mono text-xs leading-4 font-medium tracking-[1px] sm:leading-[normal] sm:font-semibold sm:tracking-normal text-[color-mix(in_srgb,var(--color-clay),white_55%)] uppercase"
const linkClass =
  "text-[15px] leading-5.75 text-cream transition-opacity hover:opacity-70 sm:text-sm sm:leading-[normal]"

const contactRow =
  "flex items-center gap-2.5 text-[15px] leading-5.75 text-cream sm:text-sm sm:leading-[normal]"
// Mobile prefixes each contact row with its icon.
const contactIcon = "size-4.5 shrink-0 text-mist sm:hidden"

// Contact rows come from Settings ▸ Contact; a field left empty there is
// simply not shown.
function ContactRows({ contact }: { contact: GlobalValue<"contact"> }) {
  const { email, phone, address } = contact
  const place = [address.city, address.country].filter(Boolean).join(", ")
  return (
    <>
      {email ? (
        <a
          href={`mailto:${email}`}
          className={`${contactRow} transition-opacity hover:opacity-70`}
        >
          <Mail aria-hidden className={contactIcon} />
          {email}
        </a>
      ) : null}
      {phone.display ? (
        phone.e164 ? (
          <a
            href={`tel:${phone.e164}`}
            className={`${contactRow} transition-opacity hover:opacity-70`}
          >
            <Phone aria-hidden className={contactIcon} />
            {phone.display}
          </a>
        ) : (
          <span className={contactRow}>
            <Phone aria-hidden className={contactIcon} />
            {phone.display}
          </span>
        )
      ) : null}
      {place ? (
        <span className={contactRow}>
          <MapPin aria-hidden className={contactIcon} />
          {place}
        </span>
      ) : null}
    </>
  )
}

export function SiteFooter({
  site,
  footer,
  contact,
  navigation,
  logo,
  cookieSettings,
}: {
  site: { name: string }
  logo?: MediaAsset | null
  footer: GlobalValue<"footer">
  contact: GlobalValue<"contact">
  navigation: GlobalValue<"navigation">
  cookieSettings: string | null
}) {
  return (
    <footer
      id="contact"
      data-site-chrome
      // pb-32 on mobile clears the fixed StickyCta bar.
      className="bg-pine pt-10 pb-32 sm:pt-16 sm:pb-12 lg:pt-24"
    >
      <Container className="flex flex-col gap-8 sm:gap-12 lg:gap-16">
        <div
          data-motion="stagger"
          className="flex flex-col gap-8 sm:gap-12 lg:flex-row lg:items-start lg:justify-between"
        >
          <div className="flex max-w-100 flex-col items-start gap-3.5 sm:gap-5">
            <Brand name={site.name} logo={logo} />
            <p className="text-[15px] leading-5.75 text-mist sm:leading-[1.6]">
              {footer.blurb}
            </p>
            {footer.social.length ? (
              <ul
                aria-label="Social media"
                className="mt-1 flex flex-wrap gap-2.5"
              >
                {footer.social.map(({ platform, url }) => (
                  <li key={`${platform}-${url}`}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${site.name} on ${SOCIAL_NAMES[platform]}`}
                      className="grid size-10 place-items-center rounded-full border border-white/12 bg-white/6 text-cream backdrop-blur-sm transition-colors hover:bg-white/14 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
                    >
                      <SocialIcon platform={platform} className="size-[18px]" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:flex sm:gap-20">
            {footer.columns.map((column, i) => (
              <nav key={i} aria-label={column.title}>
                <h2 className={columnTitle}>{column.title}</h2>
                <ul className="mt-3 flex flex-col gap-3 whitespace-nowrap sm:mt-4 sm:gap-4">
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

            <div className="col-span-2 sm:w-60">
              <h2 className={columnTitle}>Contact</h2>
              <address className="mt-3 flex flex-col gap-3 not-italic sm:mt-4 sm:gap-4">
                <ContactRows contact={contact} />
                <span className="text-[13px] leading-4.75 text-mist sm:leading-normal">
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

        <div className="flex flex-col gap-3 text-[13px] leading-[normal] text-mist sm:flex-row sm:items-center sm:justify-between sm:text-xs">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 leading-[normal] sm:gap-6">
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
          <div className="flex items-center gap-5 sm:gap-6">
            <Link
              href="/admin/sign-in"
              className="transition-opacity hover:opacity-70"
            >
              Login
            </Link>
            <p className="order-first font-plex-mono text-xs tracking-[1px] uppercase sm:order-none sm:tracking-normal sm:normal-case">
              © <CopyrightYear /> {footer.copyrightName}
            </p>
          </div>
        </div>
      </Container>
    </footer>
  )
}

import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Icon } from "@/components/icons/icon"
import { Container } from "@/components/layout/container"
import { Mail, MapPin, Phone } from "lucide-react"

import { formatAddress, mapsUrl } from "@/lib/content/address"
import type { GlobalValue } from "@/lib/content/globals"
import type { GlobalView } from "@/lib/content/types"
import type { IconName } from "@/lib/icons"
import type { ContactForm } from "./contact-form"
import { ContactFormLazy } from "./contact-form-lazy"

type Item = { icon: IconName; label: string; value: string; href?: string }

export function ContactSection({
  id,
  content,
  contact,
  channels,
  quickActions,
  form,
}: {
  id: string
  content: BlockView<"contact.details">
  contact: GlobalView<"contact">
  channels: GlobalValue<"microcopy">["contactChannels"]
  quickActions: GlobalValue<"microcopy">["quickActions"]
  form: React.ComponentProps<typeof ContactForm>
}) {
  const { eyebrow, title, subtitle } = content
  const items: Item[] = [
    {
      icon: "email",
      label: channels.email,
      value: contact.email,
      href: `mailto:${contact.email}`,
    },
    {
      icon: "phone",
      label: channels.phone,
      value: contact.phone.display,
      href: `tel:${contact.phone.e164}`,
    },
    {
      icon: "clinic",
      label: channels.clinic,
      value: formatAddress(contact.address),
      href: "#clinic",
    },
    { icon: "hours", label: channels.hours, value: contact.hours.summary },
  ]
  // Phones: one-tap shortcuts above everything else.
  const shortcuts = [
    {
      Glyph: Phone,
      label: quickActions.call,
      href: `tel:${contact.phone.e164}`,
      show: !!contact.phone.e164,
    },
    {
      Glyph: Mail,
      label: quickActions.email,
      href: `mailto:${contact.email}`,
      show: !!contact.email,
    },
    {
      Glyph: MapPin,
      label: quickActions.directions,
      href: mapsUrl(contact.address),
      show: true,
      external: true,
    },
  ].filter((s) => s.show && s.label)

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-white pt-6 sm:bg-stone sm:py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-8 sm:gap-12 xl:flex-row xl:items-start xl:gap-14">
        <div className="flex flex-col gap-6 sm:gap-8 xl:w-122.5 xl:shrink-0">
          {shortcuts.length ? (
            <ul className="grid grid-cols-3 gap-2.5 sm:hidden">
              {shortcuts.map(({ Glyph, label, href, external }) => (
                <li key={label}>
                  <a
                    href={href}
                    {...(external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-stone py-4 text-[13px] leading-4.75 font-semibold text-pine"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-pine text-white">
                      <Glyph aria-hidden className="size-4.5" />
                    </span>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-col items-start gap-3 sm:gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id={`${id}-heading`}
              data-motion="words"
              className="max-w-115 font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-ink [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px] sm:leading-[1.2] sm:tracking-normal sm:text-pine"
            >
              {title}
            </h2>
            <p
              data-motion="rise"
              className="max-w-118 text-[15px] leading-5.75 text-[#686561] sm:text-base sm:leading-[1.6] sm:text-text-muted"
            >
              {subtitle}
            </p>
          </div>

          <ul
            data-motion="deal-group"
            className="flex flex-col divide-y divide-line rounded-[20px] border border-line px-4 sm:gap-3 sm:divide-y-0 sm:rounded-none sm:border-0 sm:px-0 md:grid md:grid-cols-2 xl:flex"
          >
            {items.map(({ icon, label, value, href }) => {
              const body = (
                <>
                  <span className="flex shrink-0 rounded-xl bg-mist p-2.5 transition-colors duration-300 group-hover:bg-brand-mint sm:p-3">
                    <Icon name={icon} className="text-pine" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 leading-[1.5]">
                    <span className="text-[13px] leading-4.75 text-[#686561] sm:text-xs sm:leading-[1.5] sm:tracking-[0.72px] sm:text-clay sm:uppercase">
                      {label}
                    </span>
                    <span className="text-[15px] leading-5.75 font-semibold whitespace-pre-wrap text-pine sm:text-base sm:leading-[1.5] sm:font-medium sm:text-text-strong">
                      {value}
                    </span>
                  </span>
                </>
              )
              const card =
                "group flex items-center gap-3.5 py-3.5 sm:gap-4 sm:rounded-2xl sm:bg-white sm:py-4 sm:pr-5 sm:pl-4"
              return (
                <li key={icon}>
                  {href ? (
                    <a
                      href={href}
                      className={`${card} transition-shadow duration-300 outline-none hover:shadow-[0_16px_32px_-20px_rgba(30,79,80,0.35)] focus-visible:ring-3 focus-visible:ring-clay/50`}
                    >
                      {body}
                    </a>
                  ) : (
                    <div className={card}>{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <ContactFormLazy {...form} />
      </Container>
    </section>
  )
}

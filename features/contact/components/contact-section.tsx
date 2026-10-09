import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Icon } from "@/components/icons/icon"
import { Container } from "@/components/layout/container"
import { formatAddress } from "@/lib/content/address"
import type { GlobalValue } from "@/lib/content/globals"
import type { GlobalView } from "@/lib/content/types"
import type { IconName } from "@/lib/icons"
import { ContactForm } from "./contact-form"

type Item = { icon: IconName; label: string; value: string; href?: string }

export function ContactSection({
  id,
  content,
  contact,
  channels,
  form,
}: {
  id: string
  content: BlockView<"contact.details">
  contact: GlobalView<"contact">
  channels: GlobalValue<"microcopy">["contactChannels"]
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

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-stone py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-12 xl:flex-row xl:items-start xl:gap-14">
        <div className="flex flex-col gap-8 xl:w-122.5 xl:shrink-0">
          <div className="flex flex-col items-start gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id={`${id}-heading`}
              data-motion="words"
              className="max-w-115 font-display text-[38px] leading-[1.2] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
            >
              {title}
            </h2>
            <p
              data-motion="rise"
              className="max-w-118 text-base leading-[1.6] text-text-muted"
            >
              {subtitle}
            </p>
          </div>

          <ul
            data-motion="deal-group"
            className="flex flex-col gap-3 md:grid md:grid-cols-2 xl:flex"
          >
            {items.map(({ icon, label, value, href }) => {
              const body = (
                <>
                  <span className="flex shrink-0 rounded-xl bg-mist p-3 transition-colors duration-300 group-hover:bg-brand-mint">
                    <Icon name={icon} className="text-pine" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 leading-[1.5]">
                    <span className="text-xs tracking-[0.72px] text-clay uppercase">
                      {label}
                    </span>
                    <span className="text-base font-medium whitespace-pre-wrap text-text-strong">
                      {value}
                    </span>
                  </span>
                </>
              )
              const card =
                "group flex items-center gap-4 rounded-2xl bg-white py-4 pr-5 pl-4"
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

        <ContactForm {...form} />
      </Container>
    </section>
  )
}

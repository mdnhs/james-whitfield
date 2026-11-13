import { Icon } from "@/components/icons/icon"
import Link from "next/link"

import { Eyebrow } from "@/components/eyebrow"
import type { BlockView } from "@/blocks/media-refs"
import { Container } from "@/components/layout/container"
import type { ServiceView } from "@/lib/content/types"

export function ServicesGrid({
  id,
  content,
  services,
}: {
  id: string
  content: BlockView<"services.grid">
  services: ServiceView[]
}) {
  const { eyebrow, title, intro, more } = content

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-white pt-10 pb-12 sm:bg-stone sm:py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-6 sm:gap-14">
        <div className="flex flex-col gap-3 sm:gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-14">
          <div className="flex flex-col items-start gap-3 sm:gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id={`${id}-heading`}
              data-motion="words"
              className="max-w-140 font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-ink [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-5xl sm:leading-[1.22] sm:font-semibold sm:tracking-[-1.2px] sm:text-pine"
            >
              {title}
            </h2>
          </div>
          <p
            data-motion="rise"
            className="max-w-125 text-[15px] leading-5.75 text-[#686561] sm:text-base sm:leading-[1.6] sm:text-ink-muted"
          >
            {intro}
          </p>
        </div>

        <ul
          data-motion="deal-group"
          className="grid grid-cols-1 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {services.map(({ id: serviceId, icon, title, body, pagePath }) => (
            <li
              key={serviceId}
              data-motion="deal tilt"
              data-tilt="4"
              // Mobile: icon on the left, copy and link stacked beside it;
              // sm+: everything in one column.
              className="group relative grid grid-cols-[auto_1fr] items-start gap-x-3.5 overflow-clip rounded-[20px] bg-stone px-4 py-4.5 transition-shadow duration-500 hover:shadow-[0_24px_48px_-24px_rgba(30,79,80,0.25)] sm:flex sm:flex-col sm:gap-5 sm:bg-white sm:p-8"
            >
              <span className="row-span-2 flex rounded-[13px] bg-mist p-3.25 transition-colors duration-500 group-hover:bg-brand-mint sm:rounded-[14px] sm:p-3.5">
                <Icon name={icon} className="text-pine" />
              </span>
              <div className="flex flex-col gap-1 sm:gap-3">
                <h3 className="font-geist text-[17px] leading-6 font-semibold text-pine sm:text-2xl sm:leading-[1.3] sm:text-text-strong">
                  {title}
                </h3>
                <p className="text-[13px] leading-4.75 text-ink-muted sm:text-[15.5px] sm:leading-[1.65] sm:text-text-muted">
                  {body}
                </p>
              </div>
              {/* The link covers the card so the whole tile is clickable;
                  a card whose page is not live has none. */}
              {pagePath ? (
                <Link
                  href={pagePath}
                  aria-label={`${more.label.replace("→", "").trim()} about ${title}`}
                  className="col-start-2 pt-2.5 text-[13px] leading-4.75 font-semibold whitespace-pre text-clay outline-none after:absolute after:inset-0 after:rounded-[20px] focus-visible:after:ring-3 focus-visible:after:ring-clay/50 sm:pt-0 sm:text-[15px] sm:leading-[1.5]"
                >
                  <span className="inline-block transition-transform duration-500 ease-out group-hover:translate-x-1">
                    {more.label}
                  </span>
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

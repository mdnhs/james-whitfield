import Image from "next/image"
import Link from "next/link"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { SERVICES } from "../data/services-content"

export function ServicesGrid() {
  const { eyebrow, title, intro, more, items } = SERVICES

  return (
    <section
      id="services"
      aria-labelledby="services-heading"
      className="bg-stone py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-14">
          <div className="flex flex-col items-start gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id="services-heading"
              data-motion="words"
              className="max-w-140 font-display text-[36px] leading-[1.22] font-semibold tracking-[-1.2px] text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-5xl"
            >
              {title}
            </h2>
          </div>
          <p
            data-motion="rise"
            className="max-w-125 text-base leading-[1.6] text-ink-muted"
          >
            {intro}
          </p>
        </div>

        <ul
          data-motion="deal-group"
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {items.map(({ icon, title, body }) => (
            <li
              key={title}
              data-motion="deal tilt"
              data-tilt="4"
              className="group relative flex flex-col items-start gap-5 overflow-clip rounded-[20px] bg-white p-8 transition-shadow duration-500 hover:shadow-[0_24px_48px_-24px_rgba(30,79,80,0.25)]"
            >
              <span className="flex rounded-[14px] bg-mist p-3.5 transition-colors duration-500 group-hover:bg-brand-mint">
                <Image src={icon} alt="" width={24} height={24} />
              </span>
              <div className="flex flex-col gap-3">
                <h3 className="font-geist text-2xl leading-[1.3] font-semibold text-[#0c0c0c]">
                  {title}
                </h3>
                <p className="text-[15.5px] leading-[1.65] text-[#525252]">
                  {body}
                </p>
              </div>
              {/* The link covers the card so the whole tile is clickable. */}
              <Link
                href={more.href}
                aria-label={`${more.label.replace("→", "").trim()} about ${title}`}
                className="text-[15px] leading-[1.5] font-semibold whitespace-pre text-clay outline-none after:absolute after:inset-0 after:rounded-[20px] focus-visible:after:ring-3 focus-visible:after:ring-clay/50"
              >
                <span className="inline-block transition-transform duration-500 ease-out group-hover:translate-x-1">
                  {more.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

import Link from "next/link"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ABOUT_CREDENTIALS } from "../data/about-page-content"

export function CredentialsSection() {
  const { eyebrow, title, subtitle, cta, items } = ABOUT_CREDENTIALS

  return (
    <section
      aria-labelledby="credentials-heading"
      className="bg-stone py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-14">
        {/* Intro stays in view while the timeline scrolls past on desktop. */}
        <div className="flex flex-col items-start gap-9 lg:sticky lg:top-28 lg:w-105 lg:shrink-0">
          <div className="flex flex-col items-start gap-4">
            <div data-motion="rise">
              <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
            </div>
            <h2
              id="credentials-heading"
              data-motion="words"
              className="font-display text-[38px] leading-[1.24] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
            >
              {title}
            </h2>
            <p
              data-motion="rise"
              className="max-w-111.5 text-base leading-[1.6] text-[#525252]"
            >
              {subtitle}
            </p>
          </div>

          <Link
            href={cta.href}
            data-motion="rise"
            data-magnetic
            className={cn(
              buttonVariants(),
              "h-auto rounded-full bg-clay px-7 py-4 text-base leading-[1.5] font-semibold whitespace-pre text-cream hover:bg-clay/90"
            )}
          >
            {cta.label}
          </Link>
        </div>

        <ol
          data-motion="stagger"
          className="flex min-w-0 flex-1 flex-col gap-2"
        >
          {items.map(({ year, title, issuer }) => (
            <li
              key={title}
              className="group flex items-center gap-6 border-b border-[#e3e5dc] py-6.5 sm:gap-10"
            >
              <span className="text-[15px] leading-[1.5] text-clay tabular-nums">
                {year}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 transition-transform duration-500 ease-out group-hover:translate-x-1.5">
                <h3 className="text-lg leading-[1.3] font-semibold text-[#0c0c0c] sm:text-xl">
                  {title}
                </h3>
                <p className="text-[15px] leading-[1.5] text-[#525252] sm:text-base">
                  {issuer}
                </p>
              </div>
              <span
                aria-hidden
                className="text-xl leading-[1.5] text-brand transition-transform duration-500 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              >
                ↗
              </span>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}

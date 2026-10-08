import Link from "next/link"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ABOUT_CONTENT } from "../data/about-content"
import { StatCard } from "./stat-card"

export function AboutSection() {
  const { eyebrow, headline, quote, body, stats, cta } = ABOUT_CONTENT

  return (
    <section
      id="about"
      aria-labelledby="about-heading"
      className="bg-white pt-9 pb-16 lg:pb-26"
    >
      <Container className="flex flex-col gap-12 lg:flex-row lg:items-start lg:gap-14 xl:gap-24">
        <div className="flex w-full flex-col items-start gap-6 lg:w-[44%] lg:shrink-0 xl:w-130">
          <div data-motion="rise">
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>

          <h2
            id="about-heading"
            data-motion="words"
            className="text-[28px] leading-[1.24] font-semibold tracking-[-0.6px] text-ink sm:text-[37px]"
          >
            {headline}
          </h2>

          <blockquote className="flex w-full gap-5 pt-2.5">
            <span
              aria-hidden
              data-motion="grow"
              className="w-0.5 shrink-0 self-stretch bg-clay"
            />
            <p
              data-motion="words"
              className="font-geist text-[19px] leading-[1.5] font-medium tracking-[-0.2px] text-clay"
            >
              {quote}
            </p>
          </blockquote>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-start gap-10.5">
          <div
            data-motion="stagger"
            className="flex flex-col gap-6 text-[17px] leading-[1.72] text-ink-muted"
          >
            {body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <ul
            data-motion="stagger"
            className="grid w-full grid-cols-1 gap-3.5 pt-1.5 sm:grid-cols-3"
          >
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </ul>

          <Link
            href={cta.href}
            data-motion="rise"
            data-magnetic
            className={cn(
              buttonVariants(),
              "h-12.5 gap-0 rounded-full bg-clay px-[27px] py-0 text-[15px] leading-[normal] font-semibold whitespace-pre text-cream hover:bg-clay/90"
            )}
          >
            {`${cta.label}  →`}
          </Link>
        </div>
      </Container>
    </section>
  )
}

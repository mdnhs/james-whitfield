import Link from "next/link"

import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { StatCard } from "./stat-card"
import { ctaTrackAttrs } from "@/lib/tracking/cta"

export function AboutSection({
  id,
  content,
}: {
  id: string
  content: BlockView<"about.intro">
}) {
  const { eyebrow, headline, quote, paragraphs, stats, cta } = content

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-white py-12 sm:pt-9 sm:pb-16 lg:pb-26"
    >
      <Container className="flex flex-col gap-5 sm:gap-12 lg:flex-row lg:items-start lg:gap-14 xl:gap-24">
        <div className="flex w-full flex-col items-start gap-6 max-sm:gap-5 lg:w-[44%] lg:shrink-0 xl:w-130">
          <div data-motion="rise">
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>

          <h2
            id={`${id}-heading`}
            data-motion="words"
            className="font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-ink [font-variation-settings:'SOFT'_0,'WONK'_1] sm:font-sans sm:text-[37px] sm:leading-[1.24] sm:font-semibold sm:tracking-[-0.6px] sm:[font-variation-settings:normal]"
          >
            {headline}
          </h2>

          <blockquote className="flex w-full gap-3.5 sm:gap-5 sm:pt-2.5">
            <span
              aria-hidden
              data-motion="grow"
              className="w-0.75 shrink-0 self-stretch rounded-xs bg-clay sm:w-0.5 sm:rounded-none"
            />
            <p
              data-motion="words"
              className="font-geist text-lg leading-6.75 font-medium text-clay sm:text-[19px] sm:leading-[1.5] sm:tracking-[-0.2px]"
            >
              {quote}
            </p>
          </blockquote>
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-start gap-5 sm:gap-10.5">
          <div
            data-motion="stagger"
            className="flex flex-col gap-5 text-[15px] leading-5.75 text-ink-muted sm:gap-6 sm:text-[17px] sm:leading-[1.72]"
          >
            {paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          <ul
            data-motion="deal-group"
            className="grid w-full grid-cols-3 gap-2 sm:gap-3.5 sm:pt-1.5"
          >
            {stats.map((stat, i) => (
              <StatCard key={i} stat={stat} />
            ))}
          </ul>

          <Link
            href={cta.href}
            {...ctaTrackAttrs(cta.href, id)}
            data-motion="rise"
            data-magnetic
            className={cn(
              buttonVariants(),
              "h-13 w-full gap-0 rounded-full border border-brand bg-transparent px-6 py-0 text-base leading-5 font-semibold whitespace-pre text-brand hover:bg-brand/5 sm:h-12.5 sm:w-auto sm:border-0 sm:bg-clay sm:px-[27px] sm:text-[15px] sm:leading-[normal] sm:text-cream sm:hover:bg-clay/90"
            )}
          >
            {cta.label}
            <span aria-hidden className="hidden sm:inline">
              {"  →"}
            </span>
          </Link>
        </div>
      </Container>
    </section>
  )
}

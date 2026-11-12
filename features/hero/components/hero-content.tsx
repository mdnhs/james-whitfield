import Link from "next/link"

import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Mobile: 52px full-width pills (thumb-sized); desktop keeps the 50px pills.
const ctaBase =
  "h-13 w-full sm:h-12.5 sm:w-auto rounded-full px-6 sm:px-[27px] py-0 text-base sm:text-[15px] font-semibold leading-5 sm:leading-[normal]"

// data-hero / data-reveal / data-magnetic are animation hooks for HeroMotion
// (data-magnetic is handled page-wide by PageMotion).
export function HeroContent({ content }: { content: BlockView<"hero.home"> }) {
  const { eyebrow, headline, description, primaryCta, secondaryCta } = content

  return (
    <div className="flex w-full max-w-[1027px] flex-col items-start gap-4.5 sm:gap-6">
      <div data-hero="eyebrow" data-reveal>
        <Eyebrow
          tone="onDark"
          mobile="pill"
          className="py-1.75 pr-3.5 pl-3 font-normal tracking-normal *:first:bg-clay sm:py-2.25 sm:pr-4 sm:pl-3.5 sm:font-medium sm:tracking-[0.4px] sm:*:first:bg-white"
        >
          {eyebrow}
        </Eyebrow>
      </div>

      <h1
        data-hero="title"
        data-reveal
        className="max-w-[794px] font-display text-[40px] leading-11 font-bold tracking-[-0.5px] text-white [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[60px] sm:leading-[1.05] sm:tracking-normal lg:text-[72px]"
      >
        {/* Spaces sit outside the span so SplitText keeps them between words. */}
        {headline.lead.trim()}{" "}
        <span data-hero="muted" className="text-white/60 sm:text-white/40">
          {headline.muted.trim()}
        </span>{" "}
        {headline.tail.trim()}
      </h1>

      <p
        data-hero="desc"
        data-reveal
        className="max-w-[794px] text-[15px] leading-5.75 text-white sm:text-lg sm:leading-[1.6]"
      >
        {description}
      </p>

      <div
        data-hero="ctas"
        className="flex w-full flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap sm:gap-4 sm:pt-3"
      >
        <div data-hero="cta" data-reveal>
          <Link
            href={primaryCta.href}
            data-magnetic
            className={cn(
              buttonVariants(),
              ctaBase,
              "bg-white text-brand hover:bg-white/90"
            )}
          >
            {primaryCta.label}
          </Link>
        </div>
        <div data-hero="cta" data-reveal>
          <Link
            href={secondaryCta.href}
            data-magnetic
            className={cn(
              buttonVariants({ variant: "outline" }),
              ctaBase,
              "border-white bg-transparent text-white hover:bg-white/15 hover:text-white sm:border-white/40 sm:bg-white/5 dark:border-white/40 dark:bg-white/5 dark:hover:bg-white/15"
            )}
          >
            {secondaryCta.label}
          </Link>
        </div>
      </div>
    </div>
  )
}

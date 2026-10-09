import Link from "next/link"

import { Eyebrow } from "@/components/eyebrow"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HERO_CONTENT } from "../data/hero-content"

const ctaBase =
  "h-12.5 rounded-full px-[27px] py-0 text-[15px] font-semibold leading-[normal]"

// data-hero / data-reveal / data-magnetic are animation hooks for HeroMotion
// (data-magnetic is handled page-wide by PageMotion).
export function HeroContent() {
  const { eyebrow, headline, description, primaryCta, secondaryCta } =
    HERO_CONTENT

  return (
    <div className="flex w-full max-w-[1027px] flex-col items-start gap-6">
      <div data-hero="eyebrow" data-reveal>
        <Eyebrow tone="onDark">{eyebrow}</Eyebrow>
      </div>

      <h1
        data-hero="title"
        data-reveal
        className="max-w-[794px] font-display text-[44px] leading-[1.05] font-bold text-white [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[60px] lg:text-[72px]"
      >
        {/* Spaces sit outside the span so SplitText keeps them between words. */}
        {headline.lead.trim()}{" "}
        <span data-hero="muted" className="text-white/40">
          {headline.muted.trim()}
        </span>{" "}
        {headline.tail.trim()}
      </h1>

      <p
        data-hero="desc"
        data-reveal
        className="max-w-[794px] text-base leading-[1.6] text-white sm:text-lg"
      >
        {description}
      </p>

      <div data-hero="ctas" className="flex flex-wrap gap-4 pt-3">
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
              "border-white/40 bg-white/5 text-white hover:bg-white/15 hover:text-white dark:border-white/40 dark:bg-white/5 dark:hover:bg-white/15"
            )}
          >
            {secondaryCta.label}
          </Link>
        </div>
      </div>
    </div>
  )
}

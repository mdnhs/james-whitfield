import Link from "next/link"

import { Eyebrow } from "@/components/eyebrow"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HERO_CONTENT } from "../data/hero-content"

const ctaBase =
  "h-12.5 rounded-full px-[27px] py-0 text-[15px] font-semibold leading-[normal]"

export function HeroContent() {
  const { eyebrow, headline, description, primaryCta, secondaryCta } =
    HERO_CONTENT

  return (
    <div className="flex w-full max-w-[1027px] flex-col items-start gap-6">
      <Eyebrow tone="onDark">{eyebrow}</Eyebrow>

      <h1 className="max-w-[794px] font-display text-[44px] leading-[1.05] font-bold text-white [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[60px] lg:text-[72px]">
        {headline.lead}
        <span className="text-white/40">{headline.muted}</span>
        {headline.tail}
      </h1>

      <p className="max-w-[794px] text-base leading-[1.6] text-white sm:text-lg">
        {description}
      </p>

      <div className="flex flex-wrap gap-4 pt-3">
        <Link
          href={primaryCta.href}
          className={cn(
            buttonVariants(),
            ctaBase,
            "bg-white text-brand hover:bg-white/90"
          )}
        >
          {primaryCta.label}
        </Link>
        <Link
          href={secondaryCta.href}
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
  )
}

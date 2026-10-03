import Link from "next/link"

import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HOW_IT_WORKS, STEPS } from "../data/steps"
import { StepCard } from "./step-card"
import { StepsCarousel } from "./steps-carousel"

export function HowItWorksSection() {
  const { title, subtitle, cta } = HOW_IT_WORKS

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="flex flex-col gap-14 overflow-clip bg-brand pt-16 pb-16 lg:pt-24 lg:pb-25"
    >
      <Container className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:gap-14">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <h2
            id="how-it-works-heading"
            className="font-geist text-[32px] leading-[1.18] font-semibold tracking-[-0.8px] text-cream sm:text-[40px]"
          >
            {title}
          </h2>
          <p className="max-w-165 text-[17px] leading-[1.65] text-mist">{subtitle}</p>
        </div>

        <Link
          href={cta.href}
          className={cn(
            buttonVariants(),
            "h-13.5 shrink-0 rounded-full bg-clay px-[31px] py-0 text-[15px] leading-[normal] font-semibold text-white hover:bg-clay/90"
          )}
        >
          {cta.label}
        </Link>
      </Container>

      <StepsCarousel>
        {STEPS.map((step, i) => (
          <StepCard key={step.title} step={step} index={i} />
        ))}
      </StepsCarousel>
    </section>
  )
}

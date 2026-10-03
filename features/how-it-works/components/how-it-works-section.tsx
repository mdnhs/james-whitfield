import Link from "next/link"

import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HOW_IT_WORKS, STEPS } from "../data/steps"
import { StepCard } from "./step-card"
import { StepsCarousel } from "./steps-carousel"
import { StepsStory } from "./steps-story"

export function HowItWorksSection() {
  const { title, subtitle, cta } = HOW_IT_WORKS

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      // Pin heights for StepsStory: auto on mobile (no pin), a full-viewport
      // sticky frame with extra scroll room for the sideways walk on desktop.
      className="overflow-clip bg-brand [--steps-child:auto] [--steps-spacer:auto] lg:[--steps-child:100svh] lg:[--steps-spacer:260svh]"
    >
      <StepsStory
        header={
          <Container className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:gap-14">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <h2
                id="how-it-works-heading"
                data-motion="words"
                className="font-geist text-[32px] leading-[1.18] font-semibold tracking-[-0.8px] text-cream sm:text-[40px]"
              >
                {title}
              </h2>
              <p
                data-motion="rise"
                className="max-w-165 text-[17px] leading-[1.65] text-mist"
              >
                {subtitle}
              </p>
            </div>

            <Link
              href={cta.href}
              data-motion="rise"
              className={cn(
                buttonVariants(),
                "h-13.5 shrink-0 rounded-full bg-clay px-[31px] py-0 text-[15px] leading-[normal] font-semibold text-white hover:bg-clay/90"
              )}
            >
              {cta.label}
            </Link>
          </Container>
        }
      >
        <StepsCarousel>
          {STEPS.map((step, i) => (
            <StepCard key={step.title} step={step} index={i} />
          ))}
        </StepsCarousel>
      </StepsStory>
    </section>
  )
}

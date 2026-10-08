import Link from "next/link"

import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HOW_IT_WORKS, STEPS } from "../data/steps"
import { StepCard } from "./step-card"
import { StepsCarousel } from "./steps-carousel"
import { StepsStory } from "./steps-story"

// "page" (the How It Works page) adds a tag above the heading and sets the
// heading in the serif display face.
export function HowItWorksSection({
  variant = "home",
}: {
  variant?: "home" | "page"
}) {
  const { title, subtitle, cta, page: pageHeading } = HOW_IT_WORKS
  const page = variant === "page"

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
            <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
              {page && (
                <span
                  data-motion="rise"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border-[0.8px] border-[#ececec] bg-white px-3.5 text-sm leading-[1.5] font-medium whitespace-nowrap text-brand"
                >
                  <span
                    aria-hidden
                    className="size-1 rounded-full bg-[#315d44]"
                  />
                  {pageHeading.tag}
                </span>
              )}
              <h2
                id="how-it-works-heading"
                data-motion="words"
                className={cn(
                  "leading-[1.18] tracking-[-0.8px] text-cream",
                  page
                    ? "font-display text-[38px] font-bold [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
                    : "font-geist text-[32px] font-semibold sm:text-[40px]"
                )}
              >
                {page ? pageHeading.title : title}
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
              data-magnetic
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

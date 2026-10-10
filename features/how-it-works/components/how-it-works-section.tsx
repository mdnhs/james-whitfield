import Link from "next/link"

import type { BlockView } from "@/blocks/media-refs"
import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { stepsTimeline } from "@/lib/layout-math"
import type { ProcessStepView } from "@/lib/content/types"
import { cn } from "@/lib/utils"
import { StepCard } from "./step-card"
import { StepsCarousel } from "./steps-carousel"
import { StepsStory } from "./steps-story"

// "page" (the How It Works page) adds a tag above the heading and sets the
// heading in the serif display face.
export function HowItWorksSection({
  id,
  content,
  steps,
}: {
  id: string
  content: BlockView<"process">
  steps: ProcessStepView[]
}) {
  const { title, subtitle, cta, tag } = content
  const page = content.variant === "page"

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      // Pin heights for StepsStory: auto on mobile (no pin), a full-viewport
      // sticky frame with extra scroll room for the sideways walk on desktop.
      className="overflow-clip bg-brand [--steps-child:auto] [--steps-spacer:auto] lg:[--steps-child:100svh] lg:[--steps-spacer:var(--steps-spacer-lg)]"
      style={
        {
          "--steps-spacer-lg": stepsTimeline(steps.length).spacer,
        } as React.CSSProperties
      }
    >
      <StepsStory
        count={steps.length}
        header={
          <Container className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:gap-14">
            <div className="flex min-w-0 flex-1 flex-col items-start gap-4">
              {page && tag && (
                <span
                  data-motion="rise"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border-[0.8px] border-line-neutral bg-white px-3.5 text-sm leading-[1.5] font-medium whitespace-nowrap text-brand"
                >
                  <span aria-hidden className="size-1 rounded-full bg-moss" />
                  {tag}
                </span>
              )}
              <h2
                id={`${id}-heading`}
                data-motion="words"
                className={cn(
                  "leading-[1.18] tracking-[-0.8px] text-cream",
                  page
                    ? "font-display text-[38px] font-bold [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
                    : "font-geist text-[32px] font-semibold sm:text-[40px]"
                )}
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
              {...(cta.href.startsWith("/contact")
                ? { "data-track": "book_appointment", "data-cta-location": id }
                : {})}
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
          {steps.map((step, i) => (
            <StepCard key={step.id} step={step} index={i} />
          ))}
        </StepsCarousel>
      </StepsStory>
    </section>
  )
}

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
import { ctaTrackAttrs } from "@/lib/tracking/cta"

// "page" (the How It Works page) adds a tag above the heading and sets the
// heading in the serif display face.
export function HowItWorksSection({
  id,
  content,
  steps,
  stepTag,
}: {
  id: string
  content: BlockView<"process">
  steps: ProcessStepView[]
  stepTag: string
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
            <div className="flex min-w-0 flex-1 flex-col items-start gap-3 sm:gap-4">
              {page && tag && (
                <span
                  data-motion="rise"
                  // Mobile: rule + mono caps like every other eyebrow; sm+: pill.
                  className="inline-flex items-center gap-2 font-plex-mono text-xs leading-4 font-medium tracking-[1px] whitespace-nowrap text-mist uppercase sm:h-8 sm:gap-1.5 sm:rounded-full sm:border-[0.8px] sm:border-line-neutral sm:bg-white sm:px-3.5 sm:font-sans sm:text-sm sm:leading-[1.5] sm:tracking-normal sm:text-brand sm:normal-case"
                >
                  <span aria-hidden className="h-0.5 w-4 bg-clay sm:hidden" />
                  <span
                    aria-hidden
                    className="hidden size-1 rounded-full bg-moss sm:block"
                  />
                  {tag}
                </span>
              )}
              <h2
                id={`${id}-heading`}
                data-motion="words"
                className={cn(
                  // Mobile: the serif display face on both variants.
                  "font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-cream [font-variation-settings:'SOFT'_0,'WONK'_1] sm:leading-[1.18] sm:tracking-[-0.8px]",
                  page
                    ? "sm:text-[52px]"
                    : "sm:font-geist sm:text-[40px] sm:font-semibold sm:[font-variation-settings:normal]"
                )}
              >
                {title}
              </h2>
              <p
                data-motion="rise"
                className="max-w-165 text-[15px] leading-5.75 text-mist sm:text-[17px] sm:leading-[1.65]"
              >
                {subtitle}
              </p>
            </div>

            <Link
              href={cta.href}
              {...ctaTrackAttrs(cta.href, id)}
              data-motion="rise"
              data-magnetic
              className={cn(
                buttonVariants(),
                "hidden h-13.5 w-auto shrink-0 rounded-full bg-clay px-[31px] py-0 text-[15px] leading-[normal] font-semibold text-white hover:bg-clay/90 sm:inline-flex"
              )}
            >
              {cta.label}
            </Link>
          </Container>
        }
      >
        <StepsCarousel>
          {steps.map((step, i) => (
            <StepCard key={step.id} step={step} index={i} stepTag={stepTag} />
          ))}
        </StepsCarousel>

        {/* Mobile: the CTA sits under the carousel instead of beside the heading. */}
        <Container className="mt-5 sm:hidden">
          <Link
            href={cta.href}
            {...ctaTrackAttrs(cta.href, id)}
            className={cn(
              buttonVariants(),
              "h-13 w-full rounded-full bg-clay px-6 py-0 text-base leading-5 font-semibold text-cream hover:bg-clay/90"
            )}
          >
            {cta.label}
          </Link>
        </Container>
      </StepsStory>
    </section>
  )
}

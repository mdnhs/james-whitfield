import Image from "next/image"
import Link from "next/link"

import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { contactHref } from "@/lib/contact-href"
import type { PlanView } from "@/lib/content/types"
import { cn } from "@/lib/utils"

function PlanCard({
  plan,
  featuredTag,
}: {
  plan: PlanView
  featuredTag: string
}) {
  const { name, priceLabel, unit, summary, features, ctaLabel, featured } = plan

  return (
    <li
      data-motion="deal tilt"
      data-tilt="3"
      className={cn(
        "relative flex flex-col gap-4 overflow-clip rounded-3xl px-5 py-6 sm:gap-6 sm:rounded-[20px] sm:p-7 xl:p-9",
        featured
          ? "bg-pine text-cream"
          : "border border-line bg-white sm:border-0 sm:bg-stone"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:gap-x-4">
        <h3
          className={cn(
            "text-[17px] leading-6 font-semibold sm:text-xl sm:leading-[1.5] sm:tracking-[-0.2px]",
            featured
              ? "text-mist sm:text-cream"
              : "text-pine sm:text-text-strong"
          )}
        >
          {name}
        </h3>
        {featured && (
          <span className="rounded-full bg-clay px-2.5 py-1.25 font-plex-mono text-xs leading-4 font-medium tracking-[1px] whitespace-nowrap text-white uppercase sm:px-3 sm:py-1.5 sm:font-sans sm:leading-[1.5] sm:font-semibold sm:tracking-normal sm:text-cream sm:normal-case">
            {featuredTag}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <p className="flex items-baseline gap-2.5 whitespace-nowrap">
          <span
            className={cn(
              "font-display text-[40px] leading-11 font-bold tracking-[-0.5px] [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px] sm:leading-none sm:tracking-normal",
              featured
                ? "text-cream"
                : "text-ink sm:font-semibold sm:text-forest"
            )}
          >
            {priceLabel}
          </span>
          <span
            className={cn(
              "text-[15px] leading-5.75 sm:leading-[1.5]",
              featured
                ? "text-mist sm:text-cream/70"
                : "text-[#686561] sm:text-text-muted/85"
            )}
          >
            {unit}
          </span>
        </p>
        <p
          className={cn(
            "text-[15px] leading-5.75 sm:max-w-71.25 sm:text-sm sm:leading-[1.6]",
            featured
              ? "text-mist sm:text-cream/80"
              : "text-ink-muted sm:text-text-muted"
          )}
        >
          {summary}
        </p>
      </div>

      {/* Grows so the buttons line up across cards of different length. */}
      <ul
        className={cn(
          "flex flex-1 flex-col gap-2.5 sm:gap-3.5 sm:border-t sm:pt-5",
          featured ? "border-white/15" : "border-line"
        )}
      >
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-5.5 shrink-0 items-center justify-center rounded-full sm:size-6",
                // Mobile: clay disc on the featured card, mint elsewhere; sm+:
                // white on featured, pine elsewhere. The check flips to match.
                featured ? "bg-clay sm:bg-white" : "bg-mist sm:bg-pine"
              )}
            >
              <Image
                src="/images/services/icon-check-dark.svg"
                alt=""
                width={11.1571}
                height={8.20216}
                className={featured ? "hidden sm:block" : "sm:hidden"}
              />
              <Image
                src="/images/services/icon-check-light.svg"
                alt=""
                width={11.1571}
                height={8.20216}
                className={featured ? "sm:hidden" : "hidden sm:block"}
              />
            </span>
            <span
              className={cn(
                "text-[15px] leading-5.75 sm:text-base sm:leading-[1.5] sm:font-medium",
                featured ? "text-cream" : "text-ink-muted"
              )}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <Link
        // The form opens with this plan already mentioned.
        href={contactHref({ plan: plan.slug })}
        data-magnetic
        className={cn(
          "flex h-13 w-full items-center justify-center rounded-full px-6 text-base leading-5 font-semibold transition-colors duration-300 sm:h-auto sm:px-7 sm:py-4 sm:text-[15px] sm:leading-[1.5]",
          featured
            ? "bg-clay text-cream hover:bg-clay/90"
            : "border border-brand bg-white text-brand hover:bg-cream sm:border-[#d5dacd] sm:text-pine sm:hover:border-pine/40"
        )}
      >
        {ctaLabel}
      </Link>
    </li>
  )
}

export function FormatsSection({
  id,
  content,
  plans,
}: {
  id: string
  content: BlockView<"services.plans">
  plans: PlanView[]
}) {
  const { eyebrow, title, subtitle } = content

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-cream py-12 sm:bg-white sm:py-20 lg:py-28"
    >
      <Container className="flex flex-col gap-6 sm:gap-14">
        <header className="flex flex-col items-start gap-3 text-left sm:items-center sm:text-center">
          <div data-motion="rise">
            <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
          </div>
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className="font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-forest [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px] sm:leading-[1.3] sm:tracking-normal sm:text-pine"
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-120 text-[15px] leading-5.75 text-[#686561] sm:text-base sm:leading-[1.6] sm:text-text-muted"
          >
            {subtitle}
          </p>
        </header>

        <ul
          data-motion="deal-group"
          className="grid grid-cols-1 gap-3.5 sm:gap-6 lg:grid-cols-3"
        >
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              featuredTag={content.featuredTag}
            />
          ))}
        </ul>
      </Container>
    </section>
  )
}

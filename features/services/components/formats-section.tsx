import Image from "next/image"
import Link from "next/link"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { cn } from "@/lib/utils"
import { FORMATS, type Plan } from "../data/services-content"

function PlanCard({ plan }: { plan: Plan }) {
  const { name, price, unit, summary, features, cta, featured } = plan

  return (
    <li
      data-motion="deal tilt"
      data-tilt="3"
      className={cn(
        "relative flex flex-col gap-6 overflow-clip rounded-[20px] p-7 xl:p-9",
        featured ? "bg-pine text-cream" : "bg-stone"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3
          className={cn(
            "text-xl leading-[1.5] font-semibold tracking-[-0.2px]",
            featured ? "text-cream" : "text-[#0c0c0c]"
          )}
        >
          {name}
        </h3>
        {featured && (
          <span className="rounded-full bg-clay px-3 py-1.5 text-xs leading-[1.5] font-semibold whitespace-nowrap text-cream">
            Most chosen
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <p className="flex items-baseline gap-2.5 whitespace-nowrap">
          <span
            className={cn(
              "font-display text-[52px] leading-none [font-variation-settings:'SOFT'_0,'WONK'_1]",
              featured ? "font-bold text-cream" : "font-semibold text-forest"
            )}
          >
            {price}
          </span>
          <span
            className={cn(
              "text-[15px] leading-[1.5]",
              featured ? "text-cream/55" : "text-[#525252]/70"
            )}
          >
            {unit}
          </span>
        </p>
        <p
          className={cn(
            "max-w-71.25 text-sm leading-[1.6]",
            featured ? "text-cream/80" : "text-[#525252]"
          )}
        >
          {summary}
        </p>
      </div>

      {/* Grows so the buttons line up across cards of different length. */}
      <ul
        className={cn(
          "flex flex-1 flex-col gap-3.5 border-t pt-5",
          featured ? "border-white/15" : "border-[#dfe2d8]"
        )}
      >
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full",
                featured ? "bg-white" : "bg-pine"
              )}
            >
              <Image
                src={
                  featured
                    ? "/images/services/icon-check-dark.svg"
                    : "/images/services/icon-check-light.svg"
                }
                alt=""
                width={11.1571}
                height={8.20216}
              />
            </span>
            <span
              className={cn(
                "text-base leading-[1.5] font-medium",
                featured ? "text-cream" : "text-ink-muted"
              )}
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={cta.href}
        data-magnetic
        className={cn(
          "flex w-full items-center justify-center rounded-full px-7 py-4 text-[15px] leading-[1.5] font-semibold transition-colors duration-300",
          featured
            ? "bg-clay text-cream hover:bg-clay/90"
            : "border border-[#d5dacd] bg-white text-pine hover:border-pine/40 hover:bg-cream"
        )}
      >
        {cta.label}
      </Link>
    </li>
  )
}

export function FormatsSection() {
  const { eyebrow, title, subtitle, plans } = FORMATS

  return (
    <section
      id="formats"
      aria-labelledby="formats-heading"
      className="bg-white py-20 lg:py-28"
    >
      <Container className="flex flex-col gap-14">
        <header className="flex flex-col items-center gap-3 text-center">
          <div data-motion="rise">
            <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
          </div>
          <h2
            id="formats-heading"
            data-motion="words"
            className="font-display text-[38px] leading-[1.3] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-120 text-base leading-[1.6] text-[#525252]"
          >
            {subtitle}
          </p>
        </header>

        <ul
          data-motion="deal-group"
          className="grid grid-cols-1 gap-6 lg:grid-cols-3"
        >
          {plans.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </ul>
      </Container>
    </section>
  )
}

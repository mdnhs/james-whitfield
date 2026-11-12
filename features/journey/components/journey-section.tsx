"use client"

import Link from "next/link"
import { useRef } from "react"

import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap"
import { ctaTrackAttrs } from "@/lib/tracking/cta"
import { cn } from "@/lib/utils"

// The reading line: a step lights up once it crosses 60% of the viewport.
const LINE = "top 60%"

// Client journey. One list, each step rendered once. Phones: a vertical
// stepper whose rail fills as the reader scrolls, each numbered disc filling in
// when the rail reaches it. sm+: numbered cards (two columns, four from lg)
// with a divider above each tag.
export function JourneySection({
  id,
  content,
}: {
  id: string
  content: BlockView<"journey">
}) {
  const { eyebrow, title, steps, cta } = content
  const list = useRef<HTMLOListElement>(null)

  useGSAP(
    () => {
      const el = list.current
      if (!el) return
      const items = gsap.utils.toArray<HTMLElement>("[data-step]", el)

      const mm = gsap.matchMedia()
      mm.add(
        {
          phone: "(max-width: 639px)",
          sm: "(min-width: 640px)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { phone, sm, reduced } = context.conditions ?? {}
          // From sm the cards are dealt in by the page-wide motion
          // (PageMotion). Phones keep the stepper, so the attribute is only
          // present while the cards are.
          if (sm) {
            el.setAttribute("data-motion", "deal-group")
            return () => el.removeAttribute("data-motion")
          }
          if (!phone) return
          if (reduced) {
            items.forEach((item) => item.setAttribute("data-active", ""))
            return () =>
              items.forEach((item) => item.removeAttribute("data-active"))
          }

          items.forEach((item) => {
            ScrollTrigger.create({
              trigger: item,
              start: LINE,
              end: "max",
              onToggle: (self) =>
                item.toggleAttribute("data-active", self.isActive),
            })
            // Each segment fills from its disc down to the next one, in step
            // with the scroll.
            const fill = item.querySelector("[data-fill]")
            if (fill)
              gsap.fromTo(
                fill,
                { scaleY: 0 },
                {
                  scaleY: 1,
                  ease: "none",
                  scrollTrigger: {
                    trigger: item,
                    start: LINE,
                    end: "bottom 60%",
                    scrub: 0.4,
                  },
                }
              )
          })
          return () =>
            items.forEach((item) => item.removeAttribute("data-active"))
        }
      )
      return () => mm.revert()
    },
    { scope: list }
  )

  const number = (i: number) => String(i + 1).padStart(2, "0")

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-stone py-12 sm:py-20 lg:py-28"
    >
      <Container className="flex flex-col gap-7 sm:items-center sm:gap-14 lg:gap-20">
        <header className="flex flex-col items-start gap-3 text-forest sm:items-center sm:text-center">
          {/* Mobile: the shared rule eyebrow; sm+: plain mono caps. */}
          <div data-motion="rise" className="sm:hidden">
            <Eyebrow>{eyebrow}</Eyebrow>
          </div>
          <p
            data-motion="rise"
            className="hidden font-plex-mono text-base leading-6 tracking-[0.8px] uppercase sm:block"
          >
            {eyebrow}
          </p>
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className="font-display text-[30px] leading-9 font-bold tracking-[-0.3px] [font-variation-settings:'SOFT'_0,'WONK'_1] sm:font-sans sm:text-[44px] sm:leading-[1.2] sm:tracking-normal sm:[font-variation-settings:normal] lg:text-[53px] lg:leading-[63.8px]"
          >
            {title}
          </h2>
        </header>

        {/* One list for every width: a stepper row below sm, a card from sm.
            The page-wide card deal (data-motion="deal-group") is switched on
            from sm up in the effect above, so phones keep the stepper. */}
        <ol
          ref={list}
          className="flex flex-col sm:grid sm:w-full sm:grid-cols-2 sm:gap-6 lg:grid-cols-4"
        >
          {steps.map((step, i) => {
            const last = i === steps.length - 1
            return (
              <li
                key={i}
                data-step
                className="group flex gap-4 sm:flex-col sm:items-start sm:gap-2.75 sm:rounded-2xl sm:border sm:border-line sm:bg-white sm:p-7.25 sm:shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
              >
                <div
                  aria-hidden
                  className="flex shrink-0 flex-col items-center sm:contents"
                >
                  <span className="flex size-10 items-center justify-center rounded-full border-2 border-pine bg-stone text-[17px] leading-6 font-semibold text-pine tabular-nums transition-colors duration-500 group-data-active:bg-pine group-data-active:text-white sm:size-14 sm:border-0 sm:bg-clay sm:text-2xl sm:leading-8 sm:font-bold sm:text-white">
                    {number(i)}
                  </span>
                  {last ? null : (
                    <span className="relative w-0.5 flex-1 bg-pine/15 sm:hidden">
                      <span
                        data-fill
                        className="absolute inset-0 origin-top bg-pine"
                      />
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-start gap-2 pt-2 sm:items-stretch sm:gap-0 sm:self-stretch sm:pt-0",
                    !last && "pb-7 sm:pb-0"
                  )}
                >
                  <h3 className="text-xl leading-6.5 font-semibold tracking-[-0.2px] text-ink sm:pt-2.25 sm:text-2xl sm:leading-[1.36] sm:font-medium sm:tracking-[-0.48px]">
                    {step.title}
                  </h3>
                  <p className="text-[15px] leading-5.75 text-ink-muted sm:mt-2.75 sm:flex-1 sm:text-sm sm:leading-[1.45]">
                    {step.body}
                  </p>
                  {step.tag ? (
                    <p className="rounded-full bg-white px-3 py-1.5 text-[13px] leading-4.75 text-forest sm:mt-6 sm:rounded-none sm:border-t sm:border-line sm:bg-transparent sm:px-0 sm:pt-4.25 sm:pb-0 sm:text-xs sm:leading-4 sm:font-semibold sm:text-moss">
                      {step.tag}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>

        <Link
          href={cta.href}
          {...ctaTrackAttrs(cta.href, id)}
          data-motion="rise"
          data-magnetic
          className={cn(
            buttonVariants(),
            "h-13 w-full rounded-full bg-clay px-6 py-0 text-base leading-5 font-semibold text-cream hover:bg-clay/90 sm:h-auto sm:w-auto sm:px-7 sm:py-4 sm:text-[15px] sm:leading-[normal] sm:uppercase"
          )}
        >
          {cta.label}
        </Link>
      </Container>
    </section>
  )
}

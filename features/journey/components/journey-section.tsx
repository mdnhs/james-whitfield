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

// Client journey. Phones: a vertical stepper whose rail fills as the reader
// scrolls, each numbered disc filling in when the rail reaches it. sm+: a row
// of numbered cards (two columns, four from lg) with a divider above each tag.
export function JourneySection({
  id,
  content,
}: {
  id: string
  content: BlockView<"journey">
}) {
  const { eyebrow, title, steps, cta } = content
  const stepper = useRef<HTMLOListElement>(null)

  useGSAP(
    () => {
      const el = stepper.current
      if (!el) return
      const items = gsap.utils.toArray<HTMLElement>("[data-step]", el)

      const mm = gsap.matchMedia()
      mm.add(
        {
          phone: "(max-width: 639px)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { phone, reduced } = context.conditions ?? {}
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
    { scope: stepper }
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

        {/* Phones: scroll-driven stepper. */}
        <ol ref={stepper} className="flex flex-col sm:hidden">
          {steps.map((step, i) => {
            const last = i === steps.length - 1
            return (
              <li key={i} data-step className="group flex gap-4">
                <div
                  aria-hidden
                  className="flex shrink-0 flex-col items-center"
                >
                  <span className="flex size-10 items-center justify-center rounded-full border-2 border-pine bg-stone text-[17px] leading-6 font-semibold text-pine tabular-nums transition-colors duration-500 group-data-active:bg-pine group-data-active:text-white">
                    {number(i)}
                  </span>
                  {last ? null : (
                    <span className="relative w-0.5 flex-1 bg-pine/15">
                      <span
                        data-fill
                        className="absolute inset-0 origin-top bg-pine"
                      />
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-start gap-2 pt-2",
                    !last && "pb-7"
                  )}
                >
                  <h3 className="text-xl leading-6.5 font-semibold tracking-[-0.2px] text-ink">
                    {step.title}
                  </h3>
                  <p className="text-[15px] leading-5.75 text-ink-muted">
                    {step.body}
                  </p>
                  {step.tag ? (
                    <span className="rounded-full bg-white px-3 py-1.5 text-[13px] leading-4.75 text-forest">
                      {step.tag}
                    </span>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>

        {/* sm+: numbered cards. */}
        <ol
          data-motion="deal-group"
          className="hidden w-full gap-6 sm:grid sm:grid-cols-2 lg:grid-cols-4"
        >
          {steps.map((step, i) => (
            <li
              key={i}
              data-motion="deal"
              className="flex flex-col justify-between rounded-2xl border border-line bg-white p-7.25 shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
            >
              <div className="flex flex-col items-start gap-2.75">
                <span
                  aria-hidden
                  className="flex size-14 items-center justify-center rounded-full bg-clay text-2xl leading-8 font-bold text-white tabular-nums"
                >
                  {number(i)}
                </span>
                <h3 className="pt-2.25 text-2xl leading-[1.36] font-medium tracking-[-0.48px] text-ink">
                  {step.title}
                </h3>
                <p className="text-sm leading-[1.45] text-ink-muted">
                  {step.body}
                </p>
              </div>
              {step.tag ? (
                <p className="mt-6 border-t border-line pt-4.25 text-xs leading-4 font-semibold text-moss">
                  {step.tag}
                </p>
              ) : null}
            </li>
          ))}
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

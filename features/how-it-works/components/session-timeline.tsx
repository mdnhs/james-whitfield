"use client"

import { Clock } from "lucide-react"
import { useRef } from "react"

import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap"

// Beat card: sage on phones (pine for the current beat), white from sm.
const CARD =
  "rounded-[18px] bg-stone p-4 transition-colors duration-500 group-data-current:bg-pine sm:rounded-2xl sm:bg-white sm:p-6 sm:group-data-current:bg-white"

// Zig-zag timeline of a single session. As the reader scrolls, the rail fills
// from the first marker down and each marker lights up once the reading line
// reaches it, while its card slides in from its own side.
export function SessionTimeline({
  id,
  content,
}: {
  id: string
  content: BlockView<"session.timeline">
}) {
  const { eyebrow, title, subtitle, chip, beats } = content
  const list = useRef<HTMLOListElement>(null)

  useGSAP(
    () => {
      const el = list.current
      if (!el) return
      const items = gsap.utils.toArray<HTMLElement>("[data-beat]", el)
      const rail = el.querySelector<HTMLElement>("[data-rail]")
      const fill = el.querySelector<HTMLElement>("[data-rail-fill]")

      // Span the rail exactly from the first marker's centre to the last's.
      const place = () => {
        const markers = el.querySelectorAll<HTMLElement>("[data-marker]")
        const first = markers[0]
        const last = markers[markers.length - 1]
        if (!rail || !first || !last) return
        const origin = el.getBoundingClientRect().top
        const centre = (marker: HTMLElement) => {
          const box = marker.getBoundingClientRect()
          return box.top + box.height / 2 - origin
        }
        const top = centre(first)
        const bottom = centre(last)
        rail.style.top = `${top}px`
        rail.style.height = `${bottom - top}px`
      }
      place()
      ScrollTrigger.addEventListener("refreshInit", place)

      // The furthest beat reached is the "current" one (highlighted on
      // phones, where only one card at a time takes the pine fill).
      const markCurrent = () => {
        const reached = items.filter((item) => item.hasAttribute("data-active"))
        const current = reached[reached.length - 1]
        items.forEach((item) =>
          item.toggleAttribute("data-current", item === current)
        )
      }

      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        items.forEach((item) => item.setAttribute("data-active", ""))
        markCurrent()
        gsap.set(fill, { scaleY: 1 })
        return () => ScrollTrigger.removeEventListener("refreshInit", place)
      }

      gsap.fromTo(
        fill,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: rail,
            start: "top 60%",
            end: "bottom 60%",
            scrub: 0.6,
          },
        }
      )

      items.forEach((item, i) => {
        ScrollTrigger.create({
          trigger: item,
          start: "top 60%",
          onToggle: (self) => {
            item.toggleAttribute("data-active", self.isActive)
            markCurrent()
          },
          end: "max",
        })
        const card = item.querySelector("[data-beat-card]")
        const desktop = matchMedia("(min-width: 1024px)").matches
        gsap.fromTo(
          card,
          desktop
            ? { autoAlpha: 0, x: i % 2 ? 40 : -40 }
            : { autoAlpha: 0, y: 24 },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: { trigger: item, start: "top 80%", once: true },
          }
        )
      })

      return () => ScrollTrigger.removeEventListener("refreshInit", place)
    },
    { scope: list }
  )

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="overflow-clip bg-white py-12 sm:bg-stone sm:py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-6 sm:gap-14">
        <header className="flex flex-col items-start gap-3 text-left sm:items-center sm:text-center">
          <div data-motion="rise">
            <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
          </div>
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className="max-w-150 font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-ink [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px] sm:leading-[1.3] sm:tracking-normal sm:text-pine"
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-113.5 text-[15px] leading-5.75 text-[#686561] sm:text-base sm:leading-[1.6] sm:text-text-muted"
          >
            {subtitle}
          </p>
          {chip ? (
            <span
              data-motion="rise"
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-mist px-3.5 py-2 text-[13px] leading-4.75 text-pine"
            >
              <Clock aria-hidden className="size-4" />
              {chip}
            </span>
          ) : null}
        </header>

        <ol
          ref={list}
          className="relative flex flex-col gap-3.5 sm:gap-10 lg:gap-34"
        >
          {/* Rail: placed between the first and last marker centres. */}
          <span
            aria-hidden
            data-rail
            className="absolute top-6 left-2.25 w-0.5 bg-pine/15 sm:left-[23px] sm:bg-[#d9cfc4] lg:left-1/2 lg:-translate-x-1/2"
          >
            <span
              data-rail-fill
              className="block h-full origin-top scale-y-0 bg-pine sm:bg-brand"
            />
          </span>

          {beats.map((beat, i) => {
            const right = i % 2 === 1
            return (
              <li
                key={i}
                data-beat
                className="group relative grid grid-cols-[20px_1fr] items-start gap-4 sm:grid-cols-[48px_1fr] sm:gap-5 lg:grid-cols-[1fr_64px_1fr] lg:gap-6"
              >
                <span
                  aria-hidden
                  data-marker
                  // Mobile: a 20px node (pine, clay for the current beat) with a
                  // white pip; sm+: the numbered disc.
                  className="relative z-10 mt-4 flex size-5 items-center justify-center rounded-full bg-pine transition-colors duration-500 group-data-current:bg-clay sm:mt-0 sm:size-12 sm:border-2 sm:border-brand sm:bg-stone sm:text-base sm:font-semibold sm:text-brand sm:group-data-current:bg-brand sm:group-data-active:bg-brand sm:group-data-active:text-white lg:col-start-2 lg:row-start-1 lg:mt-10 lg:size-16 lg:text-xl"
                >
                  <span className="size-1.5 rounded-full bg-white sm:hidden" />
                  <span className="hidden sm:inline">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
                <div
                  data-beat-card
                  className={
                    right
                      ? `${CARD} lg:col-start-3 lg:row-start-1`
                      : `${CARD} lg:col-start-1 lg:row-start-1`
                  }
                >
                  <div className="flex flex-col gap-1.5 sm:gap-2.5">
                    <p className="font-plex-mono text-xs leading-4 font-medium tracking-[1px] text-clay uppercase transition-colors duration-500 group-data-current:text-mist sm:font-sans sm:text-[15px] sm:leading-[1.5] sm:font-normal sm:tracking-normal sm:normal-case sm:group-data-current:text-clay">
                      {beat.time}
                    </p>
                    <h3 className="text-[17px] leading-6 font-semibold text-pine transition-colors duration-500 group-data-current:text-white sm:text-[28px] sm:leading-[1.2] sm:tracking-[-0.28px] sm:text-[#111] sm:group-data-current:text-[#111]">
                      {beat.title}
                    </h3>
                    <p className="max-w-98.5 text-[13px] leading-4.75 text-ink-muted transition-colors duration-500 group-data-current:text-mist sm:text-base sm:leading-[1.6] sm:text-text-muted sm:group-data-current:text-text-muted">
                      {beat.body}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </Container>
    </section>
  )
}

"use client"

import { useRef } from "react"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap"
import { SESSION } from "../data/session"

// Zig-zag timeline of a single session. As the reader scrolls, the rail fills
// from the first marker down and each marker lights up once the reading line
// reaches it, while its card slides in from its own side.
export function SessionTimeline() {
  const { eyebrow, title, subtitle, beats } = SESSION
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

      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        items.forEach((item) => item.setAttribute("data-active", ""))
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
          onToggle: (self) =>
            item.toggleAttribute("data-active", self.isActive),
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
      aria-labelledby="session-heading"
      className="overflow-clip bg-stone py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-14">
        <header className="flex flex-col items-center gap-3 text-center">
          <div data-motion="rise">
            <Eyebrow className="uppercase">{eyebrow}</Eyebrow>
          </div>
          <h2
            id="session-heading"
            data-motion="words"
            className="max-w-150 font-display text-[38px] leading-[1.3] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-113.5 text-base leading-[1.6] text-[#525252]"
          >
            {subtitle}
          </p>
        </header>

        <ol ref={list} className="relative flex flex-col gap-10 lg:gap-34">
          {/* Rail: placed between the first and last marker centres. */}
          <span
            aria-hidden
            data-rail
            className="absolute top-6 left-[23px] w-0.5 bg-[#d9cfc4] lg:left-1/2 lg:-translate-x-1/2"
          >
            <span
              data-rail-fill
              className="block h-full origin-top scale-y-0 bg-brand"
            />
          </span>

          {beats.map((beat, i) => {
            const right = i % 2 === 1
            return (
              <li
                key={beat.title}
                data-beat
                className="group relative grid grid-cols-[48px_1fr] items-start gap-5 lg:grid-cols-[1fr_64px_1fr] lg:gap-6"
              >
                <span
                  aria-hidden
                  data-marker
                  className="relative z-10 flex size-12 items-center justify-center rounded-full border-2 border-brand bg-stone text-base font-semibold text-brand transition-colors duration-500 group-data-active:bg-brand group-data-active:text-white lg:col-start-2 lg:row-start-1 lg:mt-10 lg:size-16 lg:text-xl"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div
                  data-beat-card
                  className={
                    right
                      ? "rounded-2xl bg-white p-6 lg:col-start-3 lg:row-start-1"
                      : "rounded-2xl bg-white p-6 lg:col-start-1 lg:row-start-1"
                  }
                >
                  <div className="flex flex-col gap-2.5">
                    <p className="text-[15px] leading-[1.5] text-clay">
                      {beat.time}
                    </p>
                    <h3 className="text-2xl leading-[1.2] font-semibold tracking-[-0.28px] text-[#111] sm:text-[28px]">
                      {beat.title}
                    </h3>
                    <p className="max-w-98.5 text-base leading-[1.6] text-[#525252]">
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

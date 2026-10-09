"use client"

import { useRef, useState } from "react"
import { useLenis } from "lenis/react"

import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap"
import { cn } from "@/lib/utils"
import { findTarget } from "@/lib/page-root"

type Chapter = { label: string; target: string }

const EASE = (t: number) => 1 - Math.pow(1 - t, 4)

// Wayfinding for the scroll journey. Desktop: a rail on the right edge with a
// dot per chapter, a fill that tracks overall progress, and labels that open on
// hover; clicking a chapter glides there through Lenis. Mobile: a hairline
// progress bar along the top. The rail blends by difference so it stays
// legible over both the dark and the light sections.
export function JourneyRail({ chapters }: { chapters: Chapter[] }) {
  const rail = useRef<HTMLElement>(null)
  const fill = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const lenis = useLenis()

  useGSAP(() => {
    const progress = { start: 0, end: "max", scrub: 0.4 }
    gsap.fromTo(
      fill.current,
      { scaleY: 0 },
      { scaleY: 1, ease: "none", scrollTrigger: progress }
    )
    gsap.fromTo(
      bar.current,
      { scaleX: 0 },
      { scaleX: 1, ease: "none", scrollTrigger: progress }
    )

    // The rail joins once the reader has left the hero, so it never competes
    // with the opening frame.
    ScrollTrigger.create({
      start: () => innerHeight * 0.6,
      end: "max",
      onToggle: (self) =>
        gsap.to(rail.current, {
          autoAlpha: self.isActive ? 1 : 0,
          duration: 0.6,
          ease: "sine.out",
        }),
    })

    // A chapter is current while its card holds the middle of the viewport.
    // Cards sit end to end in the flow, so the ranges hand over cleanly.
    chapters.forEach(({ target }, i) => {
      const el = findTarget(target, rail.current)
      if (!el) return
      ScrollTrigger.create({
        trigger: el.closest<HTMLElement>("[data-stack]") ?? el,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => {
          if (self.isActive) setActive(i)
        },
      })
    })
  })

  const go = (target: string) => {
    const el = findTarget(target, rail.current)
    if (!el || !lenis) return
    lenis.scrollTo(target === "home" ? 0 : el, { duration: 1.6, easing: EASE })
  }

  return (
    <>
      <div
        ref={bar}
        aria-hidden
        className="fixed inset-x-0 top-0 z-70 h-0.5 origin-left scale-x-0 bg-clay xl:hidden"
      />

      <nav
        ref={rail}
        aria-label="Page sections"
        className="invisible fixed top-1/2 right-6 z-70 hidden -translate-y-1/2 opacity-0 mix-blend-difference xl:block"
      >
        <ol className="group/rail relative flex flex-col items-end gap-4.5">
          <span
            aria-hidden
            className="absolute inset-y-1 right-[3.5px] w-px bg-white/25"
          >
            <span
              ref={fill}
              className="block h-full origin-top scale-y-0 bg-white"
            />
          </span>

          {chapters.map(({ label, target }, i) => {
            const current = active === i
            return (
              <li key={target}>
                <button
                  type="button"
                  onClick={() => go(target)}
                  aria-current={current ? "step" : undefined}
                  className="flex cursor-pointer items-center gap-3 text-white outline-none"
                >
                  <span
                    className={cn(
                      "translate-x-1.5 font-dm-mono text-xs tracking-[0.08em] uppercase opacity-0 transition duration-500 ease-out group-focus-within/rail:translate-x-0 group-focus-within/rail:opacity-60 group-hover/rail:translate-x-0 group-hover/rail:opacity-60 hover:opacity-100!",
                      current &&
                        "group-hover/rail:opacity-100 2xl:translate-x-0 2xl:opacity-100"
                    )}
                  >
                    {label}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "relative size-2 rounded-full border border-white bg-black transition duration-500 ease-out",
                      current && "scale-150 bg-white"
                    )}
                  />
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}

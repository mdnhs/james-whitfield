"use client"

import { usePathname } from "next/navigation"

import { gsap, ScrollTrigger, SplitText, useGSAP } from "@/lib/gsap"

// Page-wide scrollytelling. Server-rendered sections opt in with data-motion
// tokens (space-separated, so one element can take several):
//
//   words     heading words brighten from faint as the line is read through
//             the viewport (scrubbed, so it follows the reader's pace)
//   rise      soft fade-up, once, when it enters
//   stagger   its children rise one after another, once, when it enters
//   deal      scrubbed rise from well below, one card at a time, in reading
//             order (testimonial cards)
//   deal-group  its children deal one after another on one scrub (desktop)
//   grow      scales in from its top edge, scrubbed (the about quote rule)
//   count     counts its leading number up on enter ("10+")
//   parallax  drifts against the scroll inside its clipped frame
//   drift     floats by data-speed px while passing (offset columns)
//   tilt      leans toward the pointer in 3D with a soft glare (fine pointer)
//
// Any [data-magnetic] element (CTAs) is pulled gently toward the pointer.
//
// Pinned, choreographed sections (How It Works, Enterprise) use
// @bsmnt/scrollytelling instead; this covers the reveals around them.
//
// Everything is calm on purpose: sine easing, long durations and only a few
// pixels of travel. No blur: stacked on every reveal it made the page read as
// out of focus while scrolling.
const EASE = "sine.out"

const select = (token: string) =>
  gsap.utils.toArray<HTMLElement>(`[data-motion~="${token}"]`)

const soft = { autoAlpha: 0, y: 24 }
const settled = {
  autoAlpha: 1,
  y: 0,
  duration: 1.2,
  ease: EASE,
  clearProps: "transform",
}

export function ScrollMotion() {
  // Lives in the root layout, so it rebuilds for each page's markup.
  const pathname = usePathname()

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          desktop: "(min-width: 1024px) and (pointer: fine)",
          fine: "(pointer: fine)",
        },
        (context) => {
          const { motion, desktop, fine } = context.conditions ?? {}
          if (!motion) return

          // Stacked cards. A card taller than the viewport can only stick once
          // its bottom edge reaches the viewport bottom, so its sticky top is
          // viewport height minus its own height (never below 0). The next card
          // starts covering it at exactly that moment. While the next card
          // slides up, the covered one sinks back (scales down around the middle
          // of its visible part) and dims through the shade layer.
          const stacks = gsap.utils.toArray<HTMLElement>("[data-stack]")
          const fit = () => {
            const vh = document.documentElement.clientHeight
            // Batch reads first to eliminate layout thrashing
            const heights = stacks.map((el) => el.offsetHeight)
            // Batch writes next
            stacks.forEach((el, i) => {
              if (el.dataset.stack === "last") return
              el.style.top = `${Math.min(0, vh - heights[i])}px`
              el.style.transformOrigin = `50% ${Math.max(heights[i] - vh / 2, heights[i] / 2)}px`
            })
          }
          stacks.forEach((el, i) => {
            el.style.zIndex = String(i + 1)
            if (el.dataset.stack !== "last") {
              el.style.position = "sticky"
            }
          })
          fit()
          const observer = new ResizeObserver(fit)
          stacks.forEach((el) => observer.observe(el))
          window.addEventListener("resize", fit)

          stacks.forEach((el, i) => {
            const next = stacks[i + 1]
            const shade = el.querySelector<HTMLElement>(
              ":scope > [data-stack-shade]"
            )
            if (!next || !shade) return

            gsap
              .timeline({
                defaults: { ease: "none" },
                scrollTrigger: {
                  trigger: next,
                  start: "top bottom",
                  end: "top top",
                  scrub: 0.5,
                  fastScrollEnd: true,
                },
              })
              .to(shade, { opacity: 0.55, force3D: true }, 0)
              .to(el, { scale: 0.94, force3D: true }, 0)
          })

          select("words").forEach((el) => {
            SplitText.create(el, {
              type: "words",
              autoSplit: true,
              onSplit: (split) =>
                gsap.fromTo(
                  split.words,
                  // Opacity only: per-word blur reads as smeared and forces
                  // every word onto its own layer.
                  { opacity: 0.14 },
                  {
                    opacity: 1,
                    ease: "none",
                    stagger: 0.1,
                    scrollTrigger: {
                      trigger: el,
                      start: "top 88%",
                      end: "bottom 55%",
                      scrub: 0.6,
                    },
                  }
                ),
            })
          })

          select("rise").forEach((el) => {
            gsap.fromTo(el, soft, {
              ...settled,
              delay: Number(el.dataset.delay ?? 0),
              scrollTrigger: { trigger: el, start: "top 90%", once: true },
            })
          })

          select("stagger").forEach((el) => {
            gsap.fromTo(el.children, soft, {
              ...settled,
              stagger: 0.14,
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            })
          })

          // Aligned cards (deal-group, desktop): one scrubbed timeline for the
          // row, cards rising one after another with refined travel distance.
          const grouped = (el: HTMLElement) =>
            desktop && !!el.closest('[data-motion~="deal-group"]')
          if (desktop) {
            select("deal-group").forEach((el) => {
              gsap.fromTo(
                el.children,
                { autoAlpha: 0, y: 48, force3D: true },
                {
                  autoAlpha: 1,
                  y: 0,
                  ease: "power2.out",
                  duration: 1,
                  stagger: 0.35,
                  scrollTrigger: {
                    trigger: el,
                    start: "top 95%",
                    end: "top 55%",
                    scrub: 0.6,
                    fastScrollEnd: true,
                  },
                }
              )
            })
          }

          select("deal")
            .filter((el) => !grouped(el))
            .forEach((el) => {
              gsap.fromTo(
                el,
                { autoAlpha: 0, y: 48, force3D: true },
                {
                  autoAlpha: 1,
                  y: 0,
                  ease: "power2.out",
                  scrollTrigger: {
                    trigger: el,
                    start: "top 100%",
                    end: "top 68%",
                    scrub: 0.6,
                    fastScrollEnd: true,
                  },
                }
              )
            })

          select("grow").forEach((el) => {
            gsap.fromTo(
              el,
              { scaleY: 0, autoAlpha: 0, transformOrigin: "50% 0%" },
              {
                scaleY: 1,
                autoAlpha: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: el,
                  start: "top 85%",
                  end: "bottom 60%",
                  scrub: 1,
                },
              }
            )
          })

          select("count").forEach((el) => {
            // Keep the original copy on the element: effects can run twice (dev
            // strict mode, matchMedia changes) and must not read a mid-count.
            el.dataset.count ??= el.textContent ?? ""
            const [, value, suffix = ""] =
              el.dataset.count.match(/^(\d+)(.*)$/) ?? []
            if (!value) return
            const counter = { n: 0 }
            ScrollTrigger.create({
              trigger: el,
              start: "top 90%",
              once: true,
              onEnter: () =>
                gsap.to(counter, {
                  n: Number(value),
                  duration: 2,
                  ease: "power2.out",
                  onUpdate: () => {
                    el.textContent = `${Math.round(counter.n)}${suffix}`
                  },
                }),
            })
          })

          select("parallax").forEach((el) => {
            gsap.fromTo(
              el,
              { yPercent: -6 },
              {
                yPercent: 6,
                ease: "none",
                scrollTrigger: {
                  trigger: el.parentElement ?? el,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              }
            )
          })

          if (desktop) {
            select("drift").forEach((el) => {
              const speed = Number(el.dataset.speed ?? 40)
              gsap.fromTo(
                el,
                { y: speed },
                {
                  y: -speed,
                  ease: "none",
                  scrollTrigger: {
                    trigger: el,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 1,
                  },
                }
              )
            })
          }

          // Pointer play. Both follow through quickTo so they ease toward the
          // pointer and settle back instead of snapping.
          const unbind: (() => void)[] = []
          const on = <K extends keyof HTMLElementEventMap>(
            el: HTMLElement,
            type: K,
            fn: (event: HTMLElementEventMap[K]) => void
          ) => {
            el.addEventListener(type, fn)
            unbind.push(() => el.removeEventListener(type, fn))
          }

          if (fine) {
            gsap.utils.toArray<HTMLElement>("[data-magnetic]").forEach((el) => {
              const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" })
              const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" })
              on(el, "pointermove", (event) => {
                const rect = el.getBoundingClientRect()
                x((event.clientX - (rect.left + rect.width / 2)) * 0.3)
                y((event.clientY - (rect.top + rect.height / 2)) * 0.4)
              })
              on(el, "pointerleave", () => {
                x(0)
                y(0)
              })
            })

            select("tilt").forEach((el) => {
              const glare = document.createElement("span")
              glare.setAttribute("aria-hidden", "true")
              glare.dataset.tiltGlare = ""
              el.append(glare)
              unbind.push(() => glare.remove())

              gsap.set(el, { transformPerspective: 1000 })
              const rx = gsap.quickTo(el, "rotationX", {
                duration: 0.7,
                ease: "power3",
              })
              const ry = gsap.quickTo(el, "rotationY", {
                duration: 0.7,
                ease: "power3",
              })
              const tilt = Number(el.dataset.tilt ?? 6)
              on(el, "pointerenter", () => {
                gsap.to(glare, { opacity: 1, duration: 0.5, overwrite: true })
              })
              on(el, "pointermove", (event) => {
                const rect = el.getBoundingClientRect()
                const px = (event.clientX - rect.left) / rect.width
                const py = (event.clientY - rect.top) / rect.height
                rx((0.5 - py) * tilt)
                ry((px - 0.5) * tilt * 1.3)
                glare.style.setProperty("--gx", `${px * 100}%`)
                glare.style.setProperty("--gy", `${py * 100}%`)
              })
              on(el, "pointerleave", () => {
                rx(0)
                ry(0)
                gsap.to(glare, { opacity: 0, duration: 0.6, overwrite: true })
              })
            })
          }

          ScrollTrigger.sort()
          ScrollTrigger.refresh()

          return () => {
            unbind.forEach((fn) => fn())
            observer.disconnect()
            window.removeEventListener("resize", fit)
            stacks.forEach((el) => {
              el.style.removeProperty("top")
              el.style.removeProperty("position")
              el.style.removeProperty("z-index")
              el.style.removeProperty("transform-origin")
              gsap.set(el, { clearProps: "transform" })
              const shade = el.querySelector<HTMLElement>(
                ":scope > [data-stack-shade]"
              )
              if (shade) gsap.set(shade, { clearProps: "opacity" })
            })
          }
        }
      )
    },
    { dependencies: [pathname], revertOnUpdate: true }
  )

  return null
}

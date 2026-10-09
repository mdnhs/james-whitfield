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
//   deal      card that rises, grows and fades in, scrubbed, row by row and
//             left to right; reverses on the way back up
//   deal-group  its children deal as cards (grids and lists of cards)
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
          // Grid breakpoints: crossing one rebuilds, so card rows regroup.
          sm: "(min-width: 640px)",
          md: "(min-width: 768px)",
          lg: "(min-width: 1024px)",
          xl: "(min-width: 1280px)",
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
          //
          // The sink must never start before the card has stuck, or its bottom
          // edge lifts off the next card and the dark page shows through a thin
          // seam. A card shorter than the viewport sticks when the next card's
          // top reaches its own height, not the viewport bottom, so the sink
          // starts there. It follows the scroll directly (Lenis already smooths
          // it): a scrub lag would leave the card shrunk while the next one
          // drops back on a fast scroll up, opening the same seam.
          const stacks = gsap.utils.toArray<HTMLElement>("[data-stack]")
          let measured = ""
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
            // A card that grows or shrinks in place (filters, pagination) moves
            // every boundary after it, so the triggers measure again.
            const key = `${vh}:${heights.join()}`
            if (measured && key !== measured) ScrollTrigger.refresh()
            measured = key
          }
          stacks.forEach((el, i) => {
            el.style.zIndex = String(i + 1)
            if (el.dataset.stack !== "last") {
              el.style.position = "sticky"
            }
          })
          fit()

          // Scrubbed reveals run while their element travels up the viewport,
          // but once a card sticks nothing in it travels any further: the rest
          // of a reveal would play out under the next card sliding over it,
          // unseen (the stats at the foot of the about story). So a reveal
          // inside a sticking card is squeezed to finish by the moment its card
          // sticks. Positions come from the cards' place in the flow, which a
          // stuck card's own offsets no longer report.
          const flowTop = (card: HTMLElement) => {
            const parent = card.parentElement
            let y = parent ? parent.getBoundingClientRect().top + scrollY : 0
            for (const sibling of stacks) {
              if (sibling === card) return y
              if (sibling.parentElement === parent) y += sibling.offsetHeight
            }
            return y
          }
          const within = (el: HTMLElement, card: HTMLElement) => {
            let y = 0
            let node: HTMLElement | null = el
            while (node && node !== card) {
              y += node.offsetTop
              node = node.offsetParent as HTMLElement | null
            }
            return node ? y : null
          }
          // start: element top at startAt of the viewport; end: its top or
          // bottom edge at endAt (fractions of the viewport height).
          const reveal = (
            el: HTMLElement,
            startAt: number,
            endAt: number,
            endEdge: "top" | "bottom" = "top"
          ) => {
            const range = () => {
              const vh = document.documentElement.clientHeight
              const card = el.closest<HTMLElement>("[data-stack]")
              const offset = card && within(el, card)
              if (!card || offset == null) return null
              const top = flowTop(card) + offset
              const edge = endEdge === "top" ? top : top + el.offsetHeight
              let start = top - startAt * vh
              let end = edge - endAt * vh
              if (card.dataset.stack !== "last") {
                const stick =
                  flowTop(card) + Math.max(0, card.offsetHeight - vh)
                if (end > stick) {
                  end = stick
                  start = Math.min(start, end - 0.3 * vh)
                }
              }
              return { start, end }
            }
            const pct = (n: number) => `${Math.round(n * 100)}%`
            return {
              start: () => range()?.start ?? `top ${pct(startAt)}`,
              end: () => range()?.end ?? `${endEdge} ${pct(endAt)}`,
            }
          }
          // One-shot reveals fire as their top passes `at` of the viewport. An
          // element in the bottom strip of a sticking card never gets that far,
          // so it fires when the card sticks instead.
          const enter = (el: HTMLElement, at: number) => () => {
            const vh = document.documentElement.clientHeight
            const card = el.closest<HTMLElement>("[data-stack]")
            const offset = card && within(el, card)
            if (!card || offset == null) return `top ${Math.round(at * 100)}%`
            const start = flowTop(card) + offset - at * vh
            if (card.dataset.stack === "last") return start
            return Math.min(
              start,
              flowTop(card) + Math.max(0, card.offsetHeight - vh)
            )
          }
          const observer = new ResizeObserver(fit)
          stacks.forEach((el) => observer.observe(el))
          window.addEventListener("resize", fit)

          stacks.forEach((el, i) => {
            const next = stacks[i + 1]
            const shade = el.querySelector<HTMLElement>(
              ":scope > [data-stack-shade]"
            )
            if (!next || !shade) return

            const timeline = gsap
              .timeline({
                defaults: { ease: "none" },
                scrollTrigger: {
                  trigger: next,
                  start: () =>
                    `top ${Math.min(el.offsetHeight, document.documentElement.clientHeight)}px`,
                  end: "top top",
                  scrub: true,
                },
              })
              .to(shade, { opacity: 0.55, force3D: true }, 0)
              .to(el, { scale: 0.94, force3D: true }, 0)

            // A flat card (the hero) takes on the stack's rounded top corners
            // as it sinks, so it leaves like every other card.
            if (el.hasAttribute("data-stack-flat")) {
              const radius = getComputedStyle(next).borderTopLeftRadius
              timeline.to(
                el,
                { borderTopLeftRadius: radius, borderTopRightRadius: radius },
                0
              )
            }
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
                      ...reveal(el, 0.88, 0.55, "bottom"),
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
              scrollTrigger: { trigger: el, start: enter(el, 0.9), once: true },
            })
          })

          select("stagger").forEach((el) => {
            gsap.fromTo(el.children, soft, {
              ...settled,
              stagger: 0.14,
              scrollTrigger: {
                trigger: el,
                start: enter(el, 0.88),
                once: true,
              },
            })
          })

          // Cards deal in step by step and fold away again on the way back up.
          // Every deal card and every child of a deal-group is sorted into its
          // visual row (siblings sharing a top edge, so it follows whatever
          // column count the breakpoint gives). Each row gets one scrubbed
          // timeline that starts as the row enters: its cards rise, grow and
          // fade in one after another in reading order. Scrubbed, so scrolling
          // back plays the same steps in reverse.
          const cards = new Set<HTMLElement>(select("deal"))
          select("deal-group").forEach((group) => {
            for (const child of group.children) cards.add(child as HTMLElement)
          })
          const rows = new Map<string, HTMLElement[]>()
          const parents = new Map<Element, number>()
          cards.forEach((card) => {
            const parent = card.parentElement
            if (!parent) return
            if (!parents.has(parent)) parents.set(parent, parents.size)
            const key = `${parents.get(parent)}:${Math.round(card.offsetTop / 8)}`
            rows.set(key, [...(rows.get(key) ?? []), card])
          })
          rows.forEach((row) => {
            row.sort((a, b) => a.offsetLeft - b.offsetLeft)
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: row[0],
                  ...reveal(row[0], 0.96, 0.56),
                  scrub: 0.4,
                },
              })
              .fromTo(
                row,
                {
                  autoAlpha: 0,
                  y: 96,
                  scale: 0.9,
                  transformOrigin: "50% 100%",
                  force3D: true,
                },
                {
                  autoAlpha: 1,
                  y: 0,
                  scale: 1,
                  ease: "power3.out",
                  duration: 1,
                  stagger: 0.45,
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
                  ...reveal(el, 0.85, 0.6, "bottom"),
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
              start: enter(el, 0.9),
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

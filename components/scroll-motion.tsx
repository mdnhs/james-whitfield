"use client"

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
  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        desktop: "(min-width: 1024px) and (pointer: fine)",
      },
      (context) => {
        const { motion, desktop } = context.conditions ?? {}
        if (!motion) return

        // Stacked cards. A card taller than the viewport can only stick once
        // its bottom edge reaches the viewport bottom, so its sticky top is
        // viewport height minus its own height (never below 0). The next card
        // starts covering it at exactly that moment. While the next card
        // slides up, the covered one dims smoothly through the shade layer.
        const stacks = gsap.utils.toArray<HTMLElement>("[data-stack]")
        const fit = () => {
          const vh = document.documentElement.clientHeight
          // Batch reads first to eliminate layout thrashing
          const tops = stacks.map((el) =>
            el.dataset.stack === "last" ? null : Math.min(0, vh - el.offsetHeight)
          )
          // Batch writes next
          stacks.forEach((el, i) => {
            if (tops[i] !== null) {
              el.style.top = `${tops[i]}px`
            }
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
          const shade = el.querySelector<HTMLElement>(":scope > [data-stack-shade]")
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

        ScrollTrigger.sort()
        ScrollTrigger.refresh()

        return () => {
          observer.disconnect()
          window.removeEventListener("resize", fit)
          stacks.forEach((el) => {
            el.style.removeProperty("top")
            el.style.removeProperty("position")
            el.style.removeProperty("z-index")
            const shade = el.querySelector<HTMLElement>(":scope > [data-stack-shade]")
            if (shade) gsap.set(shade, { clearProps: "opacity" })
          })
        }
      }
    )
  })

  return null
}

"use client"

import { useRef } from "react"

import { gsap, SplitText, useGSAP } from "@/lib/gsap"

// Client-only animation shell for the hero. The markup stays server-rendered;
// this targets it through data-hero hooks. Elements marked data-reveal start
// hidden via CSS (only when motion is allowed) and are revealed here.
export function HeroMotion({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const section = ref.current
      if (!section) return
      const q = gsap.utils.selector(section)
      const mm = gsap.matchMedia()

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          finePointer: "(pointer: fine)",
        },
        (context) => {
          const { motion, finePointer } = context.conditions ?? {}
          if (!motion) return

          const [bgImage] = q('[data-hero="bg-image"]')
          const [title] = q('[data-hero="title"]')
          const [count] = q('[data-hero="count"]')
          const eyebrow = q('[data-hero="eyebrow"]')
          const desc = q('[data-hero="desc"]')

          // Text motion is deliberately calm: long, sine-eased fades that come
          // out of a soft blur with only a few pixels of travel, so the copy
          // settles in like a slow breath rather than snapping into place.
          const soft = { autoAlpha: 0, y: 12, filter: "blur(8px)" }
          const clear = { autoAlpha: 1, y: 0, filter: "blur(0px)" }

          // --- Intro -------------------------------------------------------
          const intro = gsap.timeline({ defaults: { ease: "power3.out" } })

          intro
            .fromTo(
              bgImage,
              { scale: 1.2 },
              { scale: 1.06, duration: 2.4, ease: "power2.out" },
              0
            )
            .fromTo(
              eyebrow,
              soft,
              { ...clear, duration: 1.6, ease: "sine.out" },
              0.4
            )
            .fromTo(
              desc,
              soft,
              { ...clear, duration: 1.8, ease: "sine.out" },
              1.5
            )
            .fromTo(
              q('[data-hero="cta"]'),
              { autoAlpha: 0, y: 24 },
              { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1 },
              1.9
            )
            .fromTo(
              q('[data-hero="badge"]'),
              { autoAlpha: 0, x: 48 },
              { autoAlpha: 1, x: 0, duration: 1 },
              2
            )
            .fromTo(
              q('[data-hero="avatar"]'),
              { scale: 0.4, autoAlpha: 0 },
              {
                scale: 1,
                autoAlpha: 1,
                duration: 0.6,
                stagger: 0.08,
                ease: "back.out(2)",
              },
              2.15
            )

          // Count up "800+" → keeps any non-numeric suffix.
          if (count) {
            const [, value = "0", suffix = ""] =
              count.textContent?.match(/^(\d+)(.*)$/) ?? []
            const counter = { n: 0 }
            intro.to(
              counter,
              {
                n: Number(value),
                duration: 1.6,
                ease: "power2.out",
                onUpdate: () => {
                  count.textContent = `${Math.round(counter.n)}${suffix}`
                },
              },
              2.15
            )
          }

          // --- Scroll exit ---------------------------------------------------
          // As the hero scrolls away the copy drifts up and dissolves back
          // into the same soft blur, top-down, word by word for the headline.
          // A heavy scrub lag keeps it floaty. Rebuilt on every re-split
          // (font load, resize), since that replaces the word elements.
          let titleSplit: SplitText | undefined
          let exit: gsap.core.Timeline | undefined

          // context.add runs the builder now and records its tweens, so
          // rebuilds from later onSplit calls are still cleaned up by
          // matchMedia.
          const buildExit = () =>
            context.add(() => {
              if (!titleSplit) return
              exit?.revert()

              const fade = {
                autoAlpha: 0,
                y: -14,
                filter: "blur(10px)",
                ease: "sine.inOut",
                immediateRender: false,
              }

              exit = gsap
                .timeline({
                  defaults: { ease: "sine.inOut" },
                  scrollTrigger: {
                    trigger: section,
                    start: "top top",
                    end: "bottom top",
                    scrub: 1.5,
                  },
                })
                // fromTo pins the start at fully visible, whatever state the
                // intro is in when the trigger first renders.
                .fromTo(eyebrow, clear, { ...fade, duration: 0.16 }, 0)
                .fromTo(
                  titleSplit.words,
                  clear,
                  { ...fade, duration: 0.16, stagger: { amount: 0.2 } },
                  0.03
                )
                .fromTo(desc, clear, { ...fade, duration: 0.2 }, 0.16)
                .to(
                  q('[data-hero="ctas"]'),
                  { autoAlpha: 0, y: -24, duration: 0.2 },
                  0.26
                )
                .to(
                  q('[data-hero="badge"] > *'),
                  { autoAlpha: 0, y: -16, duration: 0.2, stagger: 0.05 },
                  0.4
                )
                // Pin the timeline length to 1 so positions above read as
                // fractions of the hero's scroll-out.
                .set({}, {}, 1)
            })

          // Headline: words surface one after another out of a soft blur.
          // autoSplit re-splits after the web font loads or on resize;
          // returning the tween lets SplitText restore its progress then.
          SplitText.create(title, {
            type: "words",
            autoSplit: true,
            onSplit: (split) => {
              titleSplit = split
              buildExit()
              gsap.set(title, { autoAlpha: 1 })
              return gsap.fromTo(
                split.words,
                { ...soft, y: 16, filter: "blur(12px)" },
                {
                  ...clear,
                  duration: 2,
                  stagger: 0.12,
                  ease: "sine.out",
                  delay: 0.7,
                }
              )
            },
          })

          // --- Scroll: background parallax + foreground drift ----------------
          const scrollTrigger = {
            trigger: section,
            start: "top top",
            end: "bottom top",
            scrub: true,
          }
          gsap.to(q('[data-hero="bg"]'), {
            yPercent: 18,
            ease: "none",
            scrollTrigger,
          })
          gsap.to(q('[data-hero="foreground"]'), {
            y: -120,
            ease: "none",
            scrollTrigger,
          })

          if (!finePointer) return

          // --- Pointer: magnetic CTAs (the photo's depth parallax lives in
          // HeroWebGL) ---------------------------------------------------------
          const magnets = q("[data-magnetic]").map((el) => {
            const x = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" })
            const y = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" })
            const onMove = (event: PointerEvent) => {
              const rect = el.getBoundingClientRect()
              x((event.clientX - (rect.left + rect.width / 2)) * 0.3)
              y((event.clientY - (rect.top + rect.height / 2)) * 0.4)
            }
            const onLeave = () => {
              x(0)
              y(0)
            }
            el.addEventListener("pointermove", onMove as EventListener)
            el.addEventListener("pointerleave", onLeave)
            return () => {
              el.removeEventListener("pointermove", onMove as EventListener)
              el.removeEventListener("pointerleave", onLeave)
            }
          })

          return () => {
            magnets.forEach((cleanup) => cleanup())
          }
        }
      )
    },
    { scope: ref }
  )

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  )
}

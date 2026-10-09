"use client"

import * as Scrollytelling from "@bsmnt/scrollytelling"
import { useRef, useSyncExternalStore } from "react"

import { STEPS } from "../data/steps"

const DESKTOP = "(min-width: 1024px) and (pointer: fine)"

// Off during SSR and on touch/mobile, where the steps are a swipe list.
function useDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(DESKTOP)
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => matchMedia(DESKTOP).matches,
    () => false
  )
}

// Pin timeline beats (percent of the pinned scroll). The first card is lit from
// the start; each later card gets its own window to surface.
const BEAT = 24
const surface = (i: number) => ({
  start: (i - 1) * BEAT + 8,
  end: i * BEAT + 4,
})

// Desktop scrollytelling for the steps: the section sticks to the viewport
// while vertical scroll walks the card track sideways. Heights come from CSS vars set on the
// section, so on mobile the pin collapses to auto and the carousel stays a
// plain swipe list.
//
// While pinned, each card in turn rises and scales up out of a dim state, so
// the pin tells the steps in order even on wide screens where the track barely
// moves. No blur: it smears the card copy and costs a layer per card.
//
// The track's travel is pure CSS — translateX(var(--p) * (100vw - 100%)) on the
// list — so GSAP only tweens --p from 0 to 1 and resizes need no recalculation.
export function StepsStory({
  header,
  children,
}: {
  header: React.ReactNode
  children: React.ReactNode
}) {
  const track = useRef<HTMLDivElement>(null)
  const desktop = useDesktop()
  // Later cards are resolved inside this section's own track when the
  // timeline is built (Scrollytelling reads `.current` lazily). A global
  // selector could hit a copy of this section kept in a hidden route.
  const stepAt = (index: number) =>
    ({
      get current() {
        return track.current?.querySelectorAll("li").item(index) ?? null
      },
    }) as React.RefObject<HTMLElement>

  return (
    <Scrollytelling.Root
      start="top top"
      end="bottom bottom"
      scrub={1}
      disabled={!desktop}
    >
      <div>
        <Scrollytelling.Pin
          childHeight="var(--steps-child)"
          pinSpacerHeight="var(--steps-spacer)"
          childClassName="flex flex-col justify-center gap-14 py-16 lg:py-0"
        >
          {header}

          <div ref={track} className="[--p:0]">
            {children}
          </div>
        </Scrollytelling.Pin>

        {STEPS.slice(1).map((step, i) => (
          <Scrollytelling.Animation
            key={step.title}
            tween={{
              ...surface(i + 1),
              target: stepAt(i + 1),
              fromTo: [
                { opacity: 0.3, y: 28, scale: 0.94 },
                { opacity: 1, y: 0, scale: 1, ease: "sine.out" },
              ],
            }}
          />
        ))}

        {/* Hold briefly on the first card before the track starts moving. */}
        <Scrollytelling.Animation
          tween={{
            start: 6,
            end: 100,
            target: track,
            to: { "--p": 1, ease: "none" },
          }}
        />
      </div>
    </Scrollytelling.Root>
  )
}

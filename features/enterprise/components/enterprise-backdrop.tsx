"use client"

import * as Scrollytelling from "@bsmnt/scrollytelling"
import { useRef } from "react"

// Immersive band: over the section's whole pass through the viewport, the
// backdrop opens from an inset rounded window to full bleed while the photo
// settles from a slight zoom — like stepping up to a window.
export function EnterpriseBackdrop({
  children,
}: {
  children: React.ReactNode
}) {
  const frame = useRef<HTMLDivElement>(null)
  const media = useRef<HTMLDivElement>(null)

  return (
    // Ends at "bottom bottom", not "bottom top": the section sticks once its
    // bottom reaches the viewport bottom and the next card covers it, so the
    // window must be fully open by then.
    <Scrollytelling.Root start="top bottom" end="bottom bottom" scrub={1}>
      <div aria-hidden className="absolute inset-0">
        <div ref={frame} className="absolute inset-0 overflow-clip">
          <div ref={media} className="absolute inset-0">
            {children}
          </div>
        </div>

        <Scrollytelling.Animation
          tween={{
            start: 0,
            end: 45,
            target: frame,
            fromTo: [
              { clipPath: "inset(12% 6% round 40px)" },
              { clipPath: "inset(0% 0% round 0px)", ease: "sine.out" },
            ],
          }}
        />
        <Scrollytelling.Animation
          tween={{
            start: 0,
            end: 100,
            target: media,
            fromTo: [{ scale: 1.25 }, { scale: 1, ease: "none" }],
          }}
        />
      </div>
    </Scrollytelling.Root>
  )
}

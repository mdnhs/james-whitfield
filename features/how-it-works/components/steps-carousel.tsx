"use client"

import { useRef } from "react"

// Native horizontal scroll (touch, trackpad, keyboard) plus click-drag for mouse
// users, since the design has no visible scrollbar or arrows. On desktop the
// list is driven by StepsStory instead: it lays out at full width (w-max) and
// slides by --p, so native scrolling, snapping and dragging are switched off.
export function StepsCarousel({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLUListElement>(null)
  const drag = useRef<{ x: number; scroll: number } | null>(null)

  return (
    <ul
      ref={ref}
      tabIndex={0}
      aria-label="Steps"
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return
        if (matchMedia("(min-width: 1024px)").matches) return
        drag.current = { x: e.clientX, scroll: ref.current.scrollLeft }
        ref.current.style.scrollSnapType = "none"
        ref.current.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current || !ref.current) return
        ref.current.scrollLeft =
          drag.current.scroll - (e.clientX - drag.current.x)
      }}
      onPointerUp={() => {
        drag.current = null
        if (ref.current) ref.current.style.scrollSnapType = ""
      }}
      className="flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-6 overflow-x-auto px-4 outline-none select-none sm:scroll-px-6 sm:px-6 lg:w-max lg:translate-x-[calc(var(--p)*min(0px,100vw-100%))] lg:snap-none lg:overflow-visible lg:px-[max(66px,calc((100vw-1440px)/2+66px))] [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </ul>
  )
}

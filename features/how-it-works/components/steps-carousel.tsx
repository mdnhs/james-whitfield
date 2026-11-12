"use client"

import { Children, useRef } from "react"

import { CarouselDots } from "@/components/carousel-dots"
import { useSnapIndex } from "@/hooks/use-snap-index"

// Native horizontal scroll (touch, trackpad, keyboard) plus click-drag for mouse
// users, since the design has no visible scrollbar or arrows. On desktop the
// list is driven by StepsStory instead: it lays out at full width (w-max) and
// slides by --p, so native scrolling, snapping and dragging are switched off.
export function StepsCarousel({ children }: { children: React.ReactNode }) {
  const { ref, active, onScroll } = useSnapIndex<HTMLUListElement>()
  const drag = useRef<{ x: number; scroll: number } | null>(null)
  const count = Children.count(children)

  return (
    <>
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
        onScroll={onScroll}
        onPointerUp={() => {
          drag.current = null
          if (ref.current) ref.current.style.scrollSnapType = ""
        }}
        className="flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-3 overflow-x-auto px-5 outline-none select-none sm:scroll-px-6 sm:gap-6 sm:px-6 lg:w-max lg:translate-x-[calc(var(--p)*min(0px,100vw-100%))] lg:snap-none lg:overflow-visible lg:px-[max(66px,calc((100vw-1440px)/2+66px))] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>

      <CarouselDots
        count={count}
        active={active}
        tone="onDark"
        className="mt-6 sm:hidden"
      />
    </>
  )
}

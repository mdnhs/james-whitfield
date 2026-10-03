"use client"

import { useRef } from "react"

// Native horizontal scroll (touch, trackpad, keyboard) plus click-drag for mouse
// users, since the design has no visible scrollbar or arrows.
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
        drag.current = { x: e.clientX, scroll: ref.current.scrollLeft }
        ref.current.style.scrollSnapType = "none"
        ref.current.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!drag.current || !ref.current) return
        ref.current.scrollLeft = drag.current.scroll - (e.clientX - drag.current.x)
      }}
      onPointerUp={() => {
        drag.current = null
        if (ref.current) ref.current.style.scrollSnapType = ""
      }}
      className="flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 [scrollbar-width:none] outline-none select-none sm:px-6 lg:cursor-grab lg:px-[max(66px,calc((100%-1440px)/2+66px))] lg:active:cursor-grabbing [&::-webkit-scrollbar]:hidden scroll-px-4 sm:scroll-px-6 lg:scroll-px-[max(66px,calc((100%-1440px)/2+66px))]"
    >
      {children}
    </ul>
  )
}

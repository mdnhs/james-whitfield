"use client"

import { useRef } from "react"

import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap"

// Keeps the header with the reader: it slides away while scrolling down so the
// story has the full screen, and glides back on any scroll up. Past the hero
// it gains a dark glass backing (data-scrolled) since the photo's shading no
// longer sits behind it.
export function HeaderScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const el = ref.current
    if (!el) return
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches
    let hidden = false

    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        const y = self.scroll()
        el.toggleAttribute("data-scrolled", y > innerHeight * 0.6)

        const hide = y > 140 && self.direction === 1
        if (hide === hidden) return
        hidden = hide
        gsap.to(el, {
          yPercent: hide ? -110 : 0,
          duration: calm ? 0 : hide ? 0.45 : 0.7,
          ease: hide ? "power2.in" : "power3.out",
          overwrite: true,
        })
      },
    })
  })

  return (
    <div ref={ref} className="group/header fixed inset-x-0 top-0 z-60">
      <div
        aria-hidden
        className="absolute inset-0 border-b border-white/10 bg-ink/70 opacity-0 backdrop-blur-md transition-opacity duration-500 group-data-scrolled/header:opacity-100"
      />
      {children}
    </div>
  )
}

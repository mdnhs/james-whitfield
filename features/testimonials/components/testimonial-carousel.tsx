"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import type { TestimonialView } from "@/lib/content/types"
import { cn } from "@/lib/utils"
import { TestimonialCard } from "./testimonial-card"

// Native scroll-snap track: swipe on touch, buttons on every screen. One card
// per view on mobile, two from md, three from lg.
export function TestimonialCarousel({
  items,
  label,
}: {
  items: TestimonialView[]
  label: string
}) {
  const track = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const update = useCallback(() => {
    const el = track.current
    if (!el) return
    setEdges({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    })
  }, [])

  useEffect(() => {
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [update])

  const step = (dir: 1 | -1) => {
    const el = track.current
    const card = el?.firstElementChild as HTMLElement | null
    if (!el || !card) return
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    el.scrollBy({ left: dir * (card.offsetWidth + gap), behavior: "smooth" })
  }

  const buttonClass =
    "flex size-12 items-center justify-center rounded-full border border-pine/25 text-pine transition-colors hover:bg-pine hover:text-cream disabled:pointer-events-none disabled:opacity-35"

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="flex flex-col gap-8"
    >
      <ul
        ref={track}
        onScroll={update}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-6 overflow-x-auto px-4 pb-2 lg:gap-8 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <li
            key={item.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${items.length}`}
            className="flex shrink-0 basis-full snap-start md:basis-[calc((100%-1.5rem)/2)] lg:basis-[calc((100%-4rem)/3)] [&>figure]:flex-1 [&>figure]:justify-between"
          >
            <TestimonialCard item={item} />
          </li>
        ))}
      </ul>

      <div
        className={cn(
          "flex justify-center gap-3",
          edges.start && edges.end && "hidden"
        )}
      >
        <button
          type="button"
          aria-label="Previous testimonial"
          disabled={edges.start}
          onClick={() => step(-1)}
          className={buttonClass}
        >
          <ArrowLeft className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Next testimonial"
          disabled={edges.end}
          onClick={() => step(1)}
          className={buttonClass}
        >
          <ArrowRight className="size-5" />
        </button>
      </div>
    </div>
  )
}

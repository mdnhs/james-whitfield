"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeft, ArrowRight } from "lucide-react"

import type { TestimonialView } from "@/lib/content/types"
import { CarouselDots } from "@/components/carousel-dots"
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
  const [active, setActive] = useState(0)

  const update = useCallback(() => {
    const el = track.current
    if (!el) return
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
    setEdges({ start: el.scrollLeft <= 1, end })
    const card = el.firstElementChild as HTMLElement | null
    if (!card) return
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0
    setActive(
      end
        ? el.childElementCount - 1
        : Math.round(el.scrollLeft / (card.offsetWidth + gap))
    )
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
      className="flex flex-col sm:gap-8"
    >
      <ul
        ref={track}
        // Focusable so keyboard users can scroll it with the arrow keys.
        tabIndex={0}
        onScroll={update}
        className="-mx-5 flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] gap-3 overflow-x-auto rounded-xl px-5 pt-2 pb-6 outline-none focus-visible:ring-3 focus-visible:ring-pine/30 sm:-mx-4 sm:scroll-px-4 sm:gap-6 sm:px-4 sm:pt-0 sm:pb-2 lg:gap-8 [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <li
            key={item.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${items.length}`}
            className="flex shrink-0 basis-75 snap-start sm:basis-full md:basis-[calc((100%-1.5rem)/2)] lg:basis-[calc((100%-4rem)/3)] [&>figure]:flex-1 [&>figure]:justify-between"
          >
            <TestimonialCard item={item} />
          </li>
        ))}
      </ul>

      <div
        className={cn(
          "hidden justify-center gap-3 sm:flex",
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

      {/* Mobile: pagination dots instead of arrows. */}
      <CarouselDots
        count={items.length}
        active={active}
        className="sm:hidden"
      />
    </div>
  )
}

"use client"

import { Children } from "react"

import { CarouselDots } from "@/components/carousel-dots"
import { useSnapIndex } from "@/hooks/use-snap-index"

// Mobile: a swipe rail of 272px cards with dots; sm+: the card grid.
export function InsightsRail({ children }: { children: React.ReactNode }) {
  const { ref, active, onScroll } = useSnapIndex<HTMLDivElement>()

  return (
    <div className="flex flex-col gap-6">
      <div
        ref={ref}
        onScroll={onScroll}
        data-motion="deal-group"
        className="-mx-5 flex snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] items-start gap-3.5 overflow-x-auto px-5 *:w-68 *:shrink-0 *:snap-start sm:mx-0 sm:grid sm:grid-cols-1 sm:gap-12 sm:overflow-visible sm:px-0 sm:pt-6 sm:*:w-auto md:grid-cols-2 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <CarouselDots
        count={Children.count(children)}
        active={active}
        className="sm:hidden"
      />
    </div>
  )
}

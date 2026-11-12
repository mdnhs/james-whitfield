"use client"

import { Accordion } from "@base-ui/react/accordion"

import { ScrollTrigger } from "@/lib/gsap"
import type { FaqView } from "@/lib/content/types"

// Mobile: a 28px disc (sage, white when open) around a small pine plus;
// sm+: the bare terracotta plus.
function ToggleIcon() {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-stone group-data-open:bg-white sm:size-5 sm:rounded-none sm:bg-transparent sm:group-data-open:bg-transparent"
    >
      <span className="relative size-3.5 sm:size-4">
        <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 rounded-[1px] bg-pine sm:h-0.5 sm:bg-clay sm:group-data-open:bg-cream" />
        <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 rounded-[1px] bg-pine transition-transform duration-200 group-data-open:scale-y-0 sm:w-0.5 sm:bg-clay" />
      </span>
    </span>
  )
}

export function FaqAccordion({
  items,
  initiallyOpen,
}: {
  items: FaqView[]
  initiallyOpen: number | null
}) {
  return (
    <Accordion.Root
      defaultValue={initiallyOpen === null ? [] : [initiallyOpen]}
      onValueChange={() => {
        setTimeout(() => {
          ScrollTrigger.refresh()
        }, 220)
      }}
      className="flex w-full flex-col gap-2.5 sm:gap-4"
    >
      {items.map((faq, i) => (
        <Accordion.Item
          key={faq.id}
          value={i}
          data-motion="deal"
          className="group rounded-2xl bg-white transition-colors sm:rounded-md sm:border sm:border-[#e1dbd0] sm:bg-surface-warm data-open:bg-pine sm:data-open:bg-brand"
        >
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl p-4.5 text-left text-[17px] leading-6 font-semibold text-pine outline-none group-data-open:pb-2.5 group-data-open:text-white focus-visible:ring-3 focus-visible:ring-clay/50 sm:gap-4 sm:rounded-md sm:p-[23px] sm:text-base sm:leading-[normal] sm:group-data-open:pb-3.5">
              {faq.question}
              <ToggleIcon />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
            <p className="max-w-[calc(900px+46px)] px-4.5 pb-4.5 text-[15px] leading-5.75 text-mist sm:px-[23px] sm:pb-[25px] sm:text-[15.5px] sm:leading-[1.7]">
              {faq.answer}
            </p>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

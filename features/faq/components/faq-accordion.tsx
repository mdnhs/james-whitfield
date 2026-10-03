import { Accordion } from "@base-ui/react/accordion"

import type { Faq } from "../data/faqs"

function ToggleIcon() {
  return (
    <span aria-hidden className="relative size-5 shrink-0">
      <span className="absolute top-2.25 left-0.5 h-0.5 w-4 rounded-[1px] bg-clay group-data-open:bg-cream" />
      <span className="absolute top-0.5 left-2.25 h-4 w-0.5 rounded-[1px] bg-clay transition-transform duration-200 group-data-open:scale-y-0" />
    </span>
  )
}

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  return (
    <Accordion.Root defaultValue={[0]} className="flex w-full flex-col gap-4">
      {faqs.map((faq, i) => (
        <Accordion.Item
          key={faq.question}
          value={i}
          className="group rounded-md border border-[#e1dbd0] bg-[#fcfaf7] transition-colors data-open:bg-brand"
        >
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full cursor-pointer items-center justify-between gap-4 p-[23px] text-left text-base leading-[normal] font-semibold text-pine outline-none group-data-open:pb-3.5 group-data-open:text-white focus-visible:ring-3 focus-visible:ring-clay/50 rounded-md">
              {faq.question}
              <ToggleIcon />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel className="h-(--accordion-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
            <p className="max-w-[calc(900px+46px)] px-[23px] pb-[25px] text-[15.5px] leading-[1.7] text-mist">
              {faq.answer}
            </p>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  )
}

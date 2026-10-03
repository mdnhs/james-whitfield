import { Container } from "@/components/layout/container"
import { FAQ_HEADER, FAQS } from "../data/faqs"
import { FaqAccordion } from "./faq-accordion"

export function FaqSection() {
  const { title, subtitle } = FAQ_HEADER

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="bg-stone py-20 lg:py-26"
    >
      <Container className="flex flex-col gap-13">
        <div className="flex max-w-200 flex-col gap-4">
          <h2
            id="faq-heading"
            data-motion="words"
            className="font-display text-[30px] leading-[normal] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-4xl sm:leading-[normal]"
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-160 text-base leading-[1.65] text-[#686561]"
          >
            {subtitle}
          </p>
        </div>

        <FaqAccordion faqs={FAQS} />
      </Container>
    </section>
  )
}

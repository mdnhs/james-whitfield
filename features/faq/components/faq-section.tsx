import { Container } from "@/components/layout/container"
import { cn } from "@/lib/utils"
import { FAQ_HEADER, FAQS } from "../data/faqs"
import { FaqAccordion } from "./faq-accordion"

// "page" (inner pages) sets the heading at full section size with roomier
// padding.
export function FaqSection({
  variant = "home",
}: {
  variant?: "home" | "page"
}) {
  const { title, subtitle } = FAQ_HEADER
  const page = variant === "page"

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className={cn("bg-stone py-20", page ? "lg:py-30" : "lg:py-26")}
    >
      <Container className="flex flex-col gap-13">
        <div className="flex max-w-200 flex-col gap-4">
          <h2
            id="faq-heading"
            data-motion="words"
            className={cn(
              "font-display text-[30px] leading-[normal] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:leading-[normal]",
              page ? "sm:text-[52px]" : "sm:text-4xl"
            )}
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

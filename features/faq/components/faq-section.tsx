import type { BlockView } from "@/blocks/media-refs"
import { Container } from "@/components/layout/container"
import type { FaqView } from "@/lib/content/types"
import { cn } from "@/lib/utils"
import { FaqAccordion } from "./faq-accordion"

// "page" (inner pages) sets the heading at full section size with roomier
// padding.
export function FaqSection({
  id,
  content,
  items,
}: {
  id: string
  content: BlockView<"faq">
  items: FaqView[]
}) {
  const { title, subtitle } = content
  const page = content.variant === "page"

  return (
    <section
      id={id}
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

        <FaqAccordion items={items} initiallyOpen={content.initiallyOpen} />
      </Container>
    </section>
  )
}

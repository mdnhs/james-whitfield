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
  // Also fed by service.faq, which has no selection of its own.
  content: Pick<
    BlockView<"faq">,
    "variant" | "title" | "subtitle" | "initiallyOpen"
  >
  items: FaqView[]
}) {
  const { title, subtitle } = content
  const page = content.variant === "page"

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn("bg-stone py-12 sm:py-20", page ? "lg:py-30" : "lg:py-26")}
    >
      <Container className="flex flex-col gap-6 sm:gap-13">
        <div className="flex max-w-200 flex-col gap-2.5 sm:gap-4">
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className={cn(
              "font-display text-[30px] leading-9 font-bold tracking-[-0.3px] text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:leading-[normal] sm:tracking-normal",
              page ? "sm:text-[52px]" : "sm:text-4xl"
            )}
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-160 text-[15px] leading-5.75 text-[#686561] sm:text-base sm:leading-[1.65]"
          >
            {subtitle}
          </p>
        </div>

        <FaqAccordion items={items} initiallyOpen={content.initiallyOpen} />
      </Container>
    </section>
  )
}

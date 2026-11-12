import type { BlockView } from "@/blocks/media-refs"
import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import type { TestimonialView } from "@/lib/content/types"
import { cn } from "@/lib/utils"
import { TestimonialCarousel } from "./testimonial-carousel"

// "page" (inner pages) uses the pill eyebrow and the pine heading.
export function TestimonialsSection({
  id,
  content,
  items,
}: {
  id: string
  content: BlockView<"testimonials">
  items: TestimonialView[]
}) {
  const { eyebrow, title } = content
  const page = content.variant === "page"

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-cream py-12 sm:bg-white sm:py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-4 sm:gap-14">
        <header
          className={cn(
            "flex flex-col items-start gap-3 text-left sm:items-center sm:text-center",
            page ? "text-pine" : "text-forest"
          )}
        >
          {page ? (
            <div data-motion="rise">
              <Eyebrow>{eyebrow}</Eyebrow>
            </div>
          ) : (
            <p
              data-motion="rise"
              // Mobile: rule + small mono label, as in the shared Eyebrow.
              className="inline-flex items-center gap-2 font-plex-mono text-xs leading-4 font-medium tracking-[1px] uppercase sm:font-dm-mono sm:text-base sm:leading-6 sm:font-normal sm:tracking-[0.8px]"
            >
              <span
                aria-hidden
                className="h-0.5 w-4 shrink-0 bg-clay sm:hidden"
              />
              {eyebrow}
            </p>
          )}
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className={cn(
              "font-display text-[30px] leading-9 font-bold tracking-[-0.3px] [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[53px] sm:leading-[63.8px] sm:tracking-normal",
              !page && "sm:font-sans sm:[font-variation-settings:normal]"
            )}
          >
            {title}
          </h2>
        </header>

        <TestimonialCarousel items={items} label={title} />
      </Container>
    </section>
  )
}

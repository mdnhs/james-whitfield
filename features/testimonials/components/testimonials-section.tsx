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
      className="bg-white py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-14">
        <header
          className={cn(
            "flex flex-col items-center gap-3 text-center",
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
              className="font-dm-mono text-base leading-6 tracking-[0.8px] uppercase"
            >
              {eyebrow}
            </p>
          )}
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className={cn(
              "text-[40px] leading-[1.2] font-bold sm:text-[53px] sm:leading-[63.8px]",
              page && "font-display [font-variation-settings:'SOFT'_0,'WONK'_1]"
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

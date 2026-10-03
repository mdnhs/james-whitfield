import { Container } from "@/components/layout/container"
import { TESTIMONIAL_COLUMNS, TESTIMONIALS_HEADER } from "../data/testimonials"
import { TestimonialCard } from "./testimonial-card"

export function TestimonialsSection() {
  const { eyebrow, title } = TESTIMONIALS_HEADER

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="bg-white py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-14">
        <header className="flex flex-col items-center gap-3 text-center text-forest">
          <p className="font-dm-mono text-base leading-6 tracking-[0.8px] uppercase">
            {eyebrow}
          </p>
          <h2
            id="testimonials-heading"
            className="text-[40px] leading-[1.2] font-bold sm:text-[53px] sm:leading-[63.8px]"
          >
            {title}
          </h2>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
          {TESTIMONIAL_COLUMNS.map((column, i) => (
            <div key={i} className="flex flex-col gap-6">
              {column.map((testimonial, j) => (
                <TestimonialCard key={j} {...testimonial} />
              ))}
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}

import Link from "next/link"

import { Eyebrow } from "@/components/eyebrow"
import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// /services/<slug> for a service whose details page has nothing published
// yet, in the dark hero style the site header sits on: its name and summary, a short note, and the way to get in touch.
export function ServicePlaceholder({
  slug,
  title,
  body,
  message,
  cta,
}: {
  slug: string
  title: string
  body: string
  message: string
  cta: string
}) {
  return (
    <section
      aria-labelledby="service-heading"
      className="bg-hero-base pt-36 pb-20 sm:pt-44 sm:pb-28 lg:pt-52 lg:pb-32"
    >
      <Container className="flex max-w-360 flex-col items-start gap-5 sm:gap-7">
        <Eyebrow tone="onDark" className="uppercase">
          Services
        </Eyebrow>
        <h1
          id="service-heading"
          className="max-w-200 font-display text-[36px] leading-[1.1] font-bold tracking-[-0.4px] text-cream [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-6xl sm:tracking-[-1.2px]"
        >
          {title}
        </h1>
        {body ? (
          <p className="max-w-160 text-[15px] leading-6 text-cream/80 sm:text-lg sm:leading-[1.6]">
            {body}
          </p>
        ) : null}
        <p className="max-w-160 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-[15px] leading-6 text-cream/85 sm:text-base">
          {message}
        </p>
        <Link
          href={`/contact?topic=${encodeURIComponent(slug)}`}
          className={cn(
            buttonVariants(),
            "h-13 rounded-full bg-white px-7 text-base font-semibold text-brand hover:bg-white/90 sm:h-12.5"
          )}
        >
          {cta}
        </Link>
      </Container>
    </section>
  )
}

import Link from "next/link"

import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { INSIGHTS_HEADER, POSTS } from "../data/posts"
import { PostCard } from "./post-card"

export function InsightsSection() {
  const { title, subtitle, cta } = INSIGHTS_HEADER

  return (
    <section
      id="insights"
      aria-labelledby="insights-heading"
      className="bg-white py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-6 text-forest sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <h2
              id="insights-heading"
              data-motion="words"
              className="text-[40px] leading-[1.3] font-bold sm:text-[48.9px] sm:leading-[63.8px]"
            >
              {title}
            </h2>
            <p
              data-motion="rise"
              className="max-w-[697px] text-lg leading-7.5 sm:text-xl"
            >
              {subtitle}
            </p>
          </div>

          <Link
            href={cta.href}
            data-motion="rise"
            className={cn(
              buttonVariants(),
              "h-12.5 shrink-0 rounded-full bg-clay px-[27px] py-0 text-[15px] leading-[normal] font-semibold text-cream hover:bg-clay/90"
            )}
          >
            {cta.label}
          </Link>
        </div>

        {/* Aligned cards that rise in one after another on scroll (deal-group). */}
        <div
          data-motion="deal-group"
          className="grid grid-cols-1 items-start gap-12 pt-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {POSTS.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </Container>
    </section>
  )
}

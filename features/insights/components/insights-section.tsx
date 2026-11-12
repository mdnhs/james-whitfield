import { ArrowRight } from "lucide-react"
import Link from "next/link"

import type { BlockView } from "@/blocks/media-refs"
import { Container } from "@/components/layout/container"
import { buttonVariants } from "@/components/ui/button"
import type { ArticleSummary } from "@/lib/content/types"
import { cn } from "@/lib/utils"
import { InsightsRail } from "./insights-rail"
import { PostCard } from "./post-card"
import { ctaTrackAttrs } from "@/lib/tracking/cta"

export function InsightsSection({
  id,
  content,
  articles,
}: {
  id: string
  content: BlockView<"insights.latest">
  articles: ArticleSummary[]
}) {
  const { title, subtitle, cta } = content

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-white pt-10 pb-12 sm:py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-6">
        <div className="flex flex-col items-start gap-6 text-forest sm:flex-row sm:items-center">
          <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <h2
                id={`${id}-heading`}
                data-motion="words"
                className="font-display text-[30px] leading-9 font-bold tracking-[-0.3px] [font-variation-settings:'SOFT'_0,'WONK'_1] sm:font-sans sm:text-[48.9px] sm:leading-[63.8px] sm:tracking-normal sm:[font-variation-settings:normal]"
              >
                {title}
              </h2>
              {/* Mobile: a text link beside the heading replaces the button. */}
              <Link
                href={cta.href}
                {...ctaTrackAttrs(cta.href, id)}
                className="flex shrink-0 items-center gap-1 py-2 text-[17px] leading-6 font-semibold whitespace-nowrap text-clay sm:hidden"
              >
                {cta.label}
                <ArrowRight aria-hidden className="size-4.5" />
              </Link>
            </div>
            <p
              data-motion="rise"
              className="max-w-[697px] text-[15px] leading-5.75 text-[#686561] sm:text-xl sm:leading-7.5 sm:text-forest"
            >
              {subtitle}
            </p>
          </div>

          <Link
            href={cta.href}
            {...ctaTrackAttrs(cta.href, id)}
            data-motion="rise"
            data-magnetic
            className={cn(
              buttonVariants(),
              "hidden h-12.5 w-auto shrink-0 rounded-full bg-clay px-[27px] py-0 text-[15px] leading-[normal] font-semibold text-cream hover:bg-clay/90 sm:inline-flex"
            )}
          >
            {cta.label}
          </Link>
        </div>

        {/* Aligned cards that rise in one after another on scroll (deal-group). */}
        <InsightsRail>
          {articles.map((article) => (
            <PostCard key={article.id} article={article} />
          ))}
        </InsightsRail>
      </Container>
    </section>
  )
}

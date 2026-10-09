import Link from "next/link"

import { Container } from "@/components/layout/container"
import type { GlobalValue } from "@/lib/content/globals"
import type { ArticleSummary } from "@/lib/content/types"
import { ArticleCard } from "./article-card"

// Three more articles to carry on with, dealt in like the other card grids.
export function RelatedArticles({
  id,
  articles,
  copy,
}: {
  id: string
  articles: ArticleSummary[]
  copy: GlobalValue<"microcopy">
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="bg-stone py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className="font-display text-[38px] leading-[1.3] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
          >
            {copy.keepReading}
          </h2>
          <Link
            href="/insights"
            data-motion="rise"
            className="text-[15px] font-semibold text-clay hover:underline hover:underline-offset-4"
          >
            {copy.viewAllInsights}
          </Link>
        </div>

        <div
          data-motion="deal-group"
          className="grid grid-cols-1 gap-x-7 gap-y-14 md:grid-cols-2 lg:grid-cols-3"
        >
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </Container>
    </section>
  )
}

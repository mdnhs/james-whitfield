import Link from "next/link"

import { Container } from "@/components/layout/container"
import type { Article } from "../data/articles"
import { ArticleCard } from "./article-card"

// Three more articles to carry on with, dealt in like the other card grids.
export function RelatedArticles({ articles }: { articles: Article[] }) {
  return (
    <section
      id="keep-reading"
      aria-labelledby="keep-reading-heading"
      className="bg-stone py-20 lg:py-30"
    >
      <Container className="flex flex-col gap-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2
            id="keep-reading-heading"
            data-motion="words"
            className="font-display text-[38px] leading-[1.3] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[52px]"
          >
            Keep reading
          </h2>
          <Link
            href="/insights"
            data-motion="rise"
            className="text-[15px] font-semibold text-clay hover:underline hover:underline-offset-4"
          >
            View all insights →
          </Link>
        </div>

        <div
          data-motion="deal-group"
          className="grid grid-cols-1 gap-x-7 gap-y-14 md:grid-cols-2 lg:grid-cols-3"
        >
          {articles.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </Container>
    </section>
  )
}

import type { Metadata } from "next"

import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { PageHero } from "@/components/page-hero"
import { StackCard } from "@/components/stack-card"
import {
  FeaturedArticle,
  InsightsBrowser,
  NewsletterBand,
} from "@/features/insights"
import {
  ARTICLES,
  FEATURED_ARTICLE,
  INSIGHTS_HERO,
} from "@/features/insights/data/articles"
import { MICROCOPY } from "@/features/site/data/microcopy"

import * as legacy from "../_legacy/views"

export const metadata: Metadata = {
  title: "Insights",
  description: INSIGHTS_HERO.subtitle,
}

const CHAPTERS = [
  { label: "Welcome", target: "home" },
  { label: "Articles", target: "articles" },
  { label: "Newsletter", target: "newsletter" },
  { label: "Contact", target: "contact" },
]

// Same scroll stack as the home page: each chapter is a card that sticks while
// the next slides over it.
export default function InsightsPage() {
  return (
    <main data-page-root className="bg-ink">
      <StackCard id="home" rounded={false}>
        <PageHero
          content={legacy.pageHero(INSIGHTS_HERO)}
          homeLabel={MICROCOPY.breadcrumbHome}
        />
      </StackCard>
      <StackCard>
        <InsightsBrowser
          id="articles"
          content={legacy.insightsBrowser()}
          articles={ARTICLES.map(legacy.articleSummary)}
          categories={legacy.categories()}
          copy={MICROCOPY}
          featured={
            <FeaturedArticle
              article={legacy.articleSummary(FEATURED_ARTICLE)}
              copy={MICROCOPY}
            />
          }
        />
      </StackCard>
      <StackCard last>
        <NewsletterBand id="newsletter" content={legacy.newsletter()} />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
    </main>
  )
}

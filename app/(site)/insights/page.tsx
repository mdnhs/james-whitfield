import type { Metadata } from "next"

import { JourneyRail } from "@/components/journey-rail"
import { PageHero } from "@/components/page-hero"
import { StackCard } from "@/components/stack-card"
import {
  FeaturedArticle,
  INSIGHTS_HERO,
  InsightsBrowser,
  NewsletterBand,
} from "@/features/insights"
import heroImage from "@/public/images/insights/post-agency-expertise.png"

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
    <main className="bg-ink">
      <StackCard id="home" rounded={false}>
        <PageHero {...INSIGHTS_HERO} image={heroImage} tint={0.62} />
      </StackCard>
      <StackCard id="articles">
        <InsightsBrowser featured={<FeaturedArticle />} />
      </StackCard>
      <StackCard last>
        <NewsletterBand />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
    </main>
  )
}

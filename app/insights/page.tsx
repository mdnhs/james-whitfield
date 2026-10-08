import type { Metadata } from "next"

import { PageHero } from "@/components/page-hero"
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

export default function InsightsPage() {
  return (
    <main className="bg-white">
      <PageHero {...INSIGHTS_HERO} image={heroImage} tint={0.62} />
      <InsightsBrowser featured={<FeaturedArticle />} />
      <NewsletterBand />
    </main>
  )
}

import type { Metadata } from "next"

import { PageHero } from "@/components/page-hero"
import { ABOUT_CTA } from "@/features/about-page"
import { EnterpriseSection } from "@/features/enterprise"
import { FaqSection } from "@/features/faq"
import {
  FitSection,
  HOW_IT_WORKS_HERO,
  HowItWorksSection,
  SessionTimeline,
} from "@/features/how-it-works"
import heroImage from "@/public/images/insights/post-decision-fatigue.png"

export const metadata: Metadata = {
  title: "How It Works",
  description: HOW_IT_WORKS_HERO.subtitle,
}

export default function HowItWorksPage() {
  return (
    <main className="bg-white">
      <PageHero {...HOW_IT_WORKS_HERO} image={heroImage} mirror />
      <HowItWorksSection variant="page" />
      <SessionTimeline />
      <FitSection />
      <FaqSection variant="page" />
      <EnterpriseSection id="next-step" content={ABOUT_CTA} />
    </main>
  )
}

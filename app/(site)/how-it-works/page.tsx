import type { Metadata } from "next"

import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { PageHero } from "@/components/page-hero"
import { StackCard } from "@/components/stack-card"
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

const CHAPTERS = [
  { label: "Welcome", target: "home" },
  { label: "Process", target: "how-it-works" },
  { label: "A session", target: "session" },
  { label: "Fit", target: "fit" },
  { label: "FAQ", target: "faq" },
  { label: "Next step", target: "next-step" },
  { label: "Contact", target: "contact" },
]

// Same scroll stack as the home page: each chapter is a card that sticks while
// the next slides over it.
export default function HowItWorksPage() {
  return (
    <main data-page-root className="bg-ink">
      <StackCard id="home" rounded={false}>
        <PageHero {...HOW_IT_WORKS_HERO} image={heroImage} mirror />
      </StackCard>
      <StackCard>
        <HowItWorksSection variant="page" />
      </StackCard>
      <StackCard id="session">
        <SessionTimeline />
      </StackCard>
      <StackCard id="fit">
        <FitSection />
      </StackCard>
      <StackCard>
        <FaqSection variant="page" />
      </StackCard>
      <StackCard last>
        <EnterpriseSection id="next-step" content={ABOUT_CTA} />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
    </main>
  )
}

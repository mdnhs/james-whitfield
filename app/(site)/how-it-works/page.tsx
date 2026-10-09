import type { Metadata } from "next"

import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { PageHero } from "@/components/page-hero"
import { StackCard } from "@/components/stack-card"
import { EnterpriseSection } from "@/features/enterprise"
import { FaqSection } from "@/features/faq"
import {
  FitSection,
  HowItWorksSection,
  SessionTimeline,
} from "@/features/how-it-works"
import { HOW_IT_WORKS_HERO } from "@/features/how-it-works/data/session"
import { MICROCOPY } from "@/features/site/data/microcopy"

import * as legacy from "../_legacy/views"

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
        <PageHero
          content={legacy.pageHero(HOW_IT_WORKS_HERO)}
          homeLabel={MICROCOPY.breadcrumbHome}
        />
      </StackCard>
      <StackCard>
        <HowItWorksSection
          id="how-it-works"
          content={legacy.processBlock("page")}
          steps={legacy.processSteps()}
        />
      </StackCard>
      <StackCard id="session">
        <SessionTimeline />
      </StackCard>
      <StackCard id="fit">
        <FitSection />
      </StackCard>
      <StackCard>
        <FaqSection
          id="faq"
          content={legacy.faqBlock("page")}
          items={legacy.faqItems()}
        />
      </StackCard>
      <StackCard last>
        <EnterpriseSection id="next-step" band={legacy.ctaBand("about")} />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
    </main>
  )
}

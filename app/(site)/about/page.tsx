import type { Metadata } from "next"

import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { PageHero } from "@/components/page-hero"
import { StackCard } from "@/components/stack-card"
import {
  ApproachSection,
  CredentialsSection,
  StatsBand,
  StorySection,
} from "@/features/about-page"
import { EnterpriseSection } from "@/features/enterprise"
import { TestimonialsSection } from "@/features/testimonials"
import { ABOUT_HERO } from "@/features/about-page/data/about-page-content"
import { MICROCOPY } from "@/features/site/data/microcopy"
import { SITE } from "@/features/site/data/site"

import * as legacy from "../_legacy/views"

export const metadata: Metadata = {
  title: "About",
  description:
    "The person, the practice and the principles behind every session.",
}

const CHAPTERS = [
  { label: "Welcome", target: "home" },
  { label: "Story", target: "story" },
  { label: "Approach", target: "approach" },
  { label: "Credentials", target: "credentials" },
  { label: "Stories", target: "testimonials" },
  { label: "Next step", target: "next-step" },
  { label: "Contact", target: "contact" },
]

// Same scroll stack as the home page: each chapter is a card that sticks while
// the next slides over it.
export default function AboutPage() {
  return (
    <main data-page-root className="bg-ink">
      <StackCard id="home" rounded={false}>
        <PageHero
          content={legacy.pageHero(ABOUT_HERO)}
          homeLabel={MICROCOPY.breadcrumbHome}
        />
      </StackCard>
      <StackCard>
        <StorySection
          id="story"
          content={legacy.aboutStory()}
          siteName={SITE.name}
        />
        <StatsBand id="practice-in-numbers" content={legacy.aboutStats()} />
      </StackCard>
      <StackCard>
        <ApproachSection id="approach" content={legacy.aboutApproach()} />
      </StackCard>
      <StackCard>
        <CredentialsSection
          id="credentials"
          content={legacy.aboutCredentials()}
        />
      </StackCard>
      <StackCard>
        <TestimonialsSection
          id="testimonials"
          content={legacy.testimonialsBlock("page")}
          items={legacy.testimonialItems()}
        />
      </StackCard>
      <StackCard last>
        <EnterpriseSection
          id="next-step"
          band={legacy.ctaBand("about")}
          tint={0.7}
        />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
    </main>
  )
}

import type { Metadata } from "next"

import { JourneyRail } from "@/components/journey-rail"
import { PageHero } from "@/components/page-hero"
import { StackCard } from "@/components/stack-card"
import {
  ABOUT_CTA,
  ABOUT_HERO,
  ApproachSection,
  CredentialsSection,
  StatsBand,
  StorySection,
} from "@/features/about-page"
import { EnterpriseSection } from "@/features/enterprise"
import { TestimonialsSection } from "@/features/testimonials"
import heroBg from "@/public/images/hero/hero-bg.png"

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
    <main className="bg-ink">
      <StackCard id="home" rounded={false}>
        <PageHero {...ABOUT_HERO} image={heroBg} />
      </StackCard>
      <StackCard id="story">
        <StorySection />
        <StatsBand />
      </StackCard>
      <StackCard id="approach">
        <ApproachSection />
      </StackCard>
      <StackCard id="credentials">
        <CredentialsSection />
      </StackCard>
      <StackCard>
        <TestimonialsSection variant="page" />
      </StackCard>
      <StackCard last>
        <EnterpriseSection
          id="next-step"
          content={ABOUT_CTA}
          tint="bg-pine/70"
        />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
    </main>
  )
}

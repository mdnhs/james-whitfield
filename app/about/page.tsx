import type { Metadata } from "next"

import { PageHero } from "@/components/page-hero"
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

export default function AboutPage() {
  return (
    <main className="bg-white">
      <PageHero {...ABOUT_HERO} image={heroBg} />
      <StorySection />
      <StatsBand />
      <ApproachSection />
      <CredentialsSection />
      <TestimonialsSection variant="page" />
      <EnterpriseSection id="next-step" content={ABOUT_CTA} tint="bg-pine/70" />
    </main>
  )
}

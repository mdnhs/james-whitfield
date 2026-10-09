import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { StackCard } from "@/components/stack-card"
import { AboutSection } from "@/features/about"
import { CredibilitySection } from "@/features/credibility"
import { EnterpriseSection } from "@/features/enterprise"
import { FaqSection } from "@/features/faq"
import { HeroSection } from "@/features/hero"
import { HowItWorksSection } from "@/features/how-it-works"
import { InsightsSection } from "@/features/insights"
import { TestimonialsSection } from "@/features/testimonials"

// Chapters of the scroll journey, in page order, for the side rail. Each
// target is a section id (or the hero card); #contact lives in the footer.
const CHAPTERS = [
  { label: "Welcome", target: "home" },
  { label: "About", target: "about" },
  { label: "Process", target: "how-it-works" },
  { label: "Stories", target: "testimonials" },
  { label: "Organisations", target: "enterprise" },
  { label: "Insights", target: "insights" },
  { label: "FAQ", target: "faq" },
  { label: "Contact", target: "contact" },
]

// Each StackCard sticks while the next slides over it (see PageMotion). The
// dark main background is what shows around a card as it shrinks back.
export default function Page() {
  return (
    <main data-page-root className="bg-ink">
      <StackCard id="home" rounded={false}>
        <HeroSection />
      </StackCard>
      <StackCard>
        <CredibilitySection />
        <AboutSection />
      </StackCard>
      <StackCard>
        <HowItWorksSection />
      </StackCard>
      <StackCard>
        <TestimonialsSection />
      </StackCard>
      <StackCard>
        <EnterpriseSection />
      </StackCard>
      <StackCard>
        <InsightsSection />
      </StackCard>
      <StackCard last>
        <FaqSection />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
    </main>
  )
}

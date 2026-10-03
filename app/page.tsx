import { StackCard } from "@/components/stack-card"
import { AboutSection } from "@/features/about"
import { CredibilitySection } from "@/features/credibility"
import { EnterpriseSection } from "@/features/enterprise"
import { FaqSection } from "@/features/faq"
import { HeroSection } from "@/features/hero"
import { HowItWorksSection } from "@/features/how-it-works"
import { InsightsSection } from "@/features/insights"
import { TestimonialsSection } from "@/features/testimonials"

// Each StackCard sticks while the next slides over it (see ScrollMotion). The
// dark main background is what shows around a card as it shrinks back.
export default function Page() {
  return (
    <main className="bg-ink">
      <StackCard rounded={false}>
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
    </main>
  )
}

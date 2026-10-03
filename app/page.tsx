import { AboutSection } from "@/features/about"
import { CredibilitySection } from "@/features/credibility"
import { EnterpriseSection } from "@/features/enterprise"
import { HeroSection } from "@/features/hero"
import { HowItWorksSection } from "@/features/how-it-works"
import { TestimonialsSection } from "@/features/testimonials"

export default function Page() {
  return (
    <main>
      <HeroSection />
      <CredibilitySection />
      <AboutSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <EnterpriseSection />
    </main>
  )
}

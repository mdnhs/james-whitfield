import { AboutSection } from "@/features/about"
import { CredibilitySection } from "@/features/credibility"
import { HeroSection } from "@/features/hero"
import { HowItWorksSection } from "@/features/how-it-works"

export default function Page() {
  return (
    <main>
      <HeroSection />
      <CredibilitySection />
      <AboutSection />
      <HowItWorksSection />
    </main>
  )
}

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
import { ALL_ARTICLES } from "@/features/insights/data/articles"
import { TestimonialsSection } from "@/features/testimonials"

import * as legacy from "./_legacy/views"

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
        <HeroSection content={legacy.heroHome()} />
      </StackCard>
      <StackCard>
        <CredibilitySection id="credibility" content={legacy.credibility()} />
        <AboutSection id="about" content={legacy.aboutIntro()} />
      </StackCard>
      <StackCard>
        <HowItWorksSection
          id="how-it-works"
          content={legacy.processBlock("home")}
          steps={legacy.processSteps()}
        />
      </StackCard>
      <StackCard>
        <TestimonialsSection
          id="testimonials"
          content={legacy.testimonialsBlock("home")}
          items={legacy.testimonialItems()}
        />
      </StackCard>
      <StackCard>
        <EnterpriseSection
          id="enterprise"
          band={legacy.ctaBand("enterprise")}
        />
      </StackCard>
      <StackCard>
        <InsightsSection
          id="insights"
          content={legacy.insightsLatest()}
          articles={ALL_ARTICLES.slice(0, 3).map(legacy.articleSummary)}
        />
      </StackCard>
      <StackCard last>
        <FaqSection
          id="faq"
          content={legacy.faqBlock("home")}
          items={legacy.faqItems()}
        />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
    </main>
  )
}

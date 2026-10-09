import type { Metadata } from "next"

import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { PageHero } from "@/components/page-hero"
import { StackCard } from "@/components/stack-card"
import { EnterpriseSection } from "@/features/enterprise"
import { FaqSection } from "@/features/faq"
import {
  FormatsSection,
  SERVICES_HERO,
  ServicesGrid,
} from "@/features/services"
import enterpriseBg from "@/public/images/enterprise/enterprise-bg.png"

export const metadata: Metadata = {
  title: "Services",
  description: SERVICES_HERO.subtitle,
}

const CHAPTERS = [
  { label: "Welcome", target: "home" },
  { label: "Services", target: "services" },
  { label: "Formats", target: "formats" },
  { label: "Organisations", target: "enterprise" },
  { label: "FAQ", target: "faq" },
  { label: "Contact", target: "contact" },
]

// Same scroll stack as the home page: each chapter is a card that sticks while
// the next slides over it.
export default function ServicesPage() {
  return (
    <main data-page-root className="bg-ink">
      <StackCard id="home" rounded={false}>
        <PageHero
          {...SERVICES_HERO}
          image={enterpriseBg}
          imagePosition="center 29%"
        />
      </StackCard>
      <StackCard>
        <ServicesGrid />
      </StackCard>
      <StackCard>
        <FormatsSection />
      </StackCard>
      <StackCard>
        <EnterpriseSection />
      </StackCard>
      <StackCard last>
        <FaqSection variant="page" />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
    </main>
  )
}

import type { Metadata } from "next"

import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { PageHero } from "@/components/page-hero"
import { StackCard } from "@/components/stack-card"
import { EnterpriseSection } from "@/features/enterprise"
import { FaqSection } from "@/features/faq"
import { FormatsSection, ServicesGrid } from "@/features/services"
import { SERVICES_HERO } from "@/features/services/data/services-content"
import { MICROCOPY } from "@/features/site/data/microcopy"

import * as legacy from "../_legacy/views"

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
          content={legacy.pageHero(SERVICES_HERO)}
          homeLabel={MICROCOPY.breadcrumbHome}
        />
      </StackCard>
      <StackCard>
        <ServicesGrid
          id="services"
          content={legacy.servicesGrid()}
          services={legacy.services()}
        />
      </StackCard>
      <StackCard>
        <FormatsSection
          id="formats"
          content={legacy.servicesPlans()}
          plans={legacy.plans()}
        />
      </StackCard>
      <StackCard>
        <EnterpriseSection
          id="enterprise"
          band={legacy.ctaBand("enterprise")}
        />
      </StackCard>
      <StackCard last>
        <FaqSection
          id="faq"
          content={legacy.faqBlock("page")}
          items={legacy.faqItems()}
        />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
      <PageMotion />
    </main>
  )
}

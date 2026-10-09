import type { Metadata } from "next"

import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { PageHero } from "@/components/page-hero"
import { StackCard } from "@/components/stack-card"
import { ClinicSection, ContactSection } from "@/features/contact"
import { CONTACT_HERO } from "@/features/contact/data/contact-content"
import { FaqSection } from "@/features/faq"
import { MICROCOPY } from "@/features/site/data/microcopy"

import * as legacy from "../_legacy/views"

export const metadata: Metadata = {
  title: "Contact",
  description: CONTACT_HERO.subtitle,
}

const CHAPTERS = [
  { label: "Welcome", target: "home" },
  { label: "Get in touch", target: "get-in-touch" },
  { label: "Clinic", target: "clinic" },
  { label: "FAQ", target: "faq" },
]

// Same scroll stack as the home page: each chapter is a card that sticks while
// the next slides over it.
export default function ContactPage() {
  return (
    <main data-page-root className="bg-ink">
      <StackCard id="home" rounded={false}>
        <PageHero
          content={legacy.pageHero(CONTACT_HERO)}
          homeLabel={MICROCOPY.breadcrumbHome}
        />
      </StackCard>
      <StackCard>
        <ContactSection
          id="get-in-touch"
          content={legacy.contactDetails()}
          contact={legacy.contact()}
          channels={MICROCOPY.contactChannels}
          form={legacy.contactForm()}
        />
      </StackCard>
      <StackCard>
        <ClinicSection
          id="clinic"
          content={legacy.contactClinic()}
          contact={legacy.contact()}
          directionsLabel={MICROCOPY.directions}
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

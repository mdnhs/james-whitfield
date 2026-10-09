import type { Metadata } from "next"

import { JourneyRail } from "@/components/journey-rail"
import { PageHero } from "@/components/page-hero"
import { StackCard } from "@/components/stack-card"
import { ClinicSection, CONTACT_HERO, ContactSection } from "@/features/contact"
import { FaqSection } from "@/features/faq"
import heroImage from "@/public/images/contact/contact-hero.png"

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
    <main className="bg-ink">
      <StackCard id="home" rounded={false}>
        <PageHero
          {...CONTACT_HERO}
          image={heroImage}
          imagePosition="center 38%"
        />
      </StackCard>
      <StackCard>
        <ContactSection />
      </StackCard>
      <StackCard>
        <ClinicSection />
      </StackCard>
      <StackCard last>
        <FaqSection />
      </StackCard>
      <JourneyRail chapters={CHAPTERS} />
    </main>
  )
}

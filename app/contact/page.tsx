import type { Metadata } from "next"

import { PageHero } from "@/components/page-hero"
import { ClinicSection, CONTACT_HERO, ContactSection } from "@/features/contact"
import { FaqSection } from "@/features/faq"
import heroImage from "@/public/images/contact/contact-hero.png"

export const metadata: Metadata = {
  title: "Contact",
  description: CONTACT_HERO.subtitle,
}

export default function ContactPage() {
  return (
    <main className="bg-white">
      <PageHero
        {...CONTACT_HERO}
        image={heroImage}
        imagePosition="center 38%"
      />
      <ContactSection />
      <ClinicSection />
      <FaqSection />
    </main>
  )
}

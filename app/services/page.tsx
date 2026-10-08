import type { Metadata } from "next"

import { PageHero } from "@/components/page-hero"
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

export default function ServicesPage() {
  return (
    <main className="bg-white">
      <PageHero
        {...SERVICES_HERO}
        image={enterpriseBg}
        imagePosition="center 29%"
      />
      <ServicesGrid />
      <FormatsSection />
      <EnterpriseSection />
      <FaqSection variant="page" />
    </main>
  )
}

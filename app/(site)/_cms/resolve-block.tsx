import type { BlockInstance } from "@/blocks/registry"
import { collectMediaIds, resolveMedia } from "@/blocks/media-refs"
import { PageHero } from "@/components/page-hero"
import {
  ApproachSection,
  CredentialsSection,
  StatsBand,
  StorySection,
} from "@/features/about-page"
import { AboutSection } from "@/features/about"
import { ClinicSection, ContactSection } from "@/features/contact"
import { CredibilitySection } from "@/features/credibility"
import { EnterpriseSection } from "@/features/enterprise"
import { FaqSection } from "@/features/faq"
import { HeroSection } from "@/features/hero"
import {
  FitSection,
  HowItWorksSection,
  SessionTimeline,
} from "@/features/how-it-works"
import {
  FeaturedArticle,
  InsightsBrowser,
  InsightsSection,
  NewsletterBand,
  toNewsletterView,
} from "@/features/insights"
import { RichTextSection } from "@/features/richtext"
import { FormatsSection, ServicesGrid } from "@/features/services"
import { TestimonialsSection } from "@/features/testimonials"
import { select } from "@/lib/content/select"
import { slugify } from "@/lib/utils"
import { turnstileSiteKey } from "@/server/lib/turnstile"
import * as q from "@/server/modules/content/queries"

const withMedia = async <T,>(value: T) =>
  resolveMedia(value, await q.getMedia(collectMediaIds(value)))

// One block → its section, with the collection rows and globals it uses.
// Heroes render no id: the first StackCard is #home.
export async function ResolvedBlock({ block }: { block: BlockInstance }) {
  const id = block.anchor
  switch (block.type) {
    case "hero.home":
      return <HeroSection content={await withMedia(block.data)} />
    case "hero.page": {
      const [content, copy] = await Promise.all([
        withMedia(block.data),
        q.getSetting("microcopy"),
      ])
      return <PageHero content={content} homeLabel={copy.breadcrumbHome} />
    }
    case "credibility":
      return <CredibilitySection id={id} content={block.data} />
    case "about.intro":
      return <AboutSection id={id} content={block.data} />
    case "process": {
      const steps = (await q.getProcessSteps()).slice(0, 6)
      return <HowItWorksSection id={id} content={block.data} steps={steps} />
    }
    case "testimonials": {
      const items = select(await q.getTestimonials(), block.data.selection)
      return <TestimonialsSection id={id} content={block.data} items={items} />
    }
    case "band": {
      const band = await q.getCtaBand(block.data.bandId)
      return band ? (
        <EnterpriseSection id={id} band={band} tint={block.data.tint} />
      ) : null
    }
    case "insights.latest": {
      const all = await q.getArticleSummaries()
      const articles = select(all, block.data.selection).slice(
        0,
        block.data.count
      )
      return (
        <InsightsSection id={id} content={block.data} articles={articles} />
      )
    }
    case "faq": {
      const items = select(await q.getFaqs(), block.data.selection)
      return <FaqSection id={id} content={block.data} items={items} />
    }
    case "about.story": {
      const [content, site] = await Promise.all([
        withMedia(block.data),
        q.getSetting("site"),
      ])
      return <StorySection id={id} content={content} siteName={site.name} />
    }
    case "about.stats":
      return <StatsBand id={id} content={block.data} />
    case "about.approach":
      return <ApproachSection id={id} content={block.data} />
    case "about.credentials":
      return <CredentialsSection id={id} content={block.data} />
    case "services.grid":
      return (
        <ServicesGrid
          id={id}
          content={block.data}
          services={await q.getServices()}
        />
      )
    case "services.plans":
      return (
        <FormatsSection
          id={id}
          content={block.data}
          plans={(await q.getPlans()).slice(0, 4)}
        />
      )
    case "session.timeline":
      return <SessionTimeline id={id} content={block.data} />
    case "fit":
      return <FitSection id={id} content={block.data} />
    case "insights.browser": {
      const [all, categories, copy] = await Promise.all([
        q.getArticleSummaries(),
        q.getCategories(),
        q.getSetting("microcopy"),
      ])
      const featured = all.find((a) => a.featured)
      return (
        <InsightsBrowser
          id={id}
          content={block.data}
          articles={all.filter((a) => !a.featured)}
          categories={categories}
          copy={copy}
          featured={
            featured ? <FeaturedArticle article={featured} copy={copy} /> : null
          }
        />
      )
    }
    case "newsletter": {
      const global = await withMedia(await q.getSetting("newsletter"))
      const override = block.data.override
      const content = toNewsletterView({
        ...global,
        eyebrow: override?.eyebrow || global.eyebrow,
        title: override?.title || global.title,
        subtitle: override?.subtitle || global.subtitle,
      })
      return <NewsletterBand id={id} content={content} />
    }
    case "contact.details": {
      const [contact, copy, form, services, plans] = await Promise.all([
        q.getSetting("contact").then(withMedia),
        q.getSetting("microcopy"),
        q.getSetting("contactForm"),
        q.getServices(),
        q.getPlans(),
      ])
      const option = (label: string) => ({ slug: slugify(label), label })
      return (
        <ContactSection
          id={id}
          content={block.data}
          contact={contact}
          channels={copy.contactChannels}
          form={{
            copy: form,
            topics: [
              ...services.map((s) => ({ slug: s.slug, label: s.title })),
              ...form.extraTopics.map(option),
            ],
            formats: form.formats.map(option),
            turnstileSiteKey: turnstileSiteKey(),
            plans: plans.map(({ slug, name, priceLabel, unit }) => ({
              slug,
              name,
              priceLabel,
              unit,
            })),
          }}
        />
      )
    }
    case "contact.clinic": {
      const [content, contact, copy] = await Promise.all([
        withMedia(block.data),
        q.getSetting("contact").then(withMedia),
        q.getSetting("microcopy"),
      ])
      return (
        <ClinicSection
          id={id}
          content={content}
          contact={contact}
          directionsLabel={copy.directions}
        />
      )
    }
    case "richtext":
      return <RichTextSection id={id} content={block.data} />
    default: {
      // Compile-time exhaustive; at runtime an unknown type (a row written by
      // a newer or older build) skips its section instead of failing the page.
      const unknown: { type: string; id: string } = block satisfies never
      console.warn(
        `[content] block ${unknown.id} has unknown type "${unknown.type}"; skipped`
      )
      return null
    }
  }
}

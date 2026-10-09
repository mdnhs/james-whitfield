// Transitional (Tasks 4–8): builds, from the old fixtures, exactly the props
// the database supplies from Task 9 on. Deleted in Task 9.
import type { BlockView } from "@/blocks/media-refs"
import { cropToFrame } from "@/lib/content/frame"
import type {
  ArticleDetail,
  ArticleSummary,
  CategoryView,
  ContactOption,
  CtaBandView,
  FaqView,
  GlobalView,
  PlanOption,
  PlanView,
  ProcessStepView,
  ServiceView,
  TestimonialView,
} from "@/lib/content/types"
import { fromPath } from "@/lib/media"
import { slugify } from "@/lib/utils"
import { plainText, readingMinutes, toTipTap } from "@/server/db/seed/tiptap"
import {
  CLINIC,
  CONTACT,
  CONTACT_FORM,
  CONTACT_INFO,
} from "@/features/contact/data/contact-content"
import {
  CATEGORIES,
  FEATURED_ARTICLE,
  getArticleBody,
  NEWSLETTER,
  PAGE_SIZE,
  type Article,
  type Category,
} from "@/features/insights/data/articles"
import type { NewsletterView } from "@/features/insights/components/newsletter-band"
import { INSIGHTS_HEADER } from "@/features/insights/data/posts"
import { FORMATS, SERVICES } from "@/features/services/data/services-content"
import { ABOUT_CONTENT } from "@/features/about/data/about-content"
import {
  ABOUT_APPROACH,
  ABOUT_CREDENTIALS,
  ABOUT_CTA,
  ABOUT_STATS,
  ABOUT_STORY,
} from "@/features/about-page/data/about-page-content"
import { CREDENTIALS } from "@/features/credibility/data/credentials"
import { ENTERPRISE_CONTENT } from "@/features/enterprise/data/enterprise-content"
import { FAQ_HEADER, FAQS } from "@/features/faq/data/faqs"
import { HERO_CONTENT } from "@/features/hero/data/hero-content"
import { FIT, SESSION } from "@/features/how-it-works/data/session"
import { HOW_IT_WORKS, STEPS } from "@/features/how-it-works/data/steps"
import {
  TESTIMONIALS,
  TESTIMONIALS_HEADER,
} from "@/features/testimonials/data/testimonials"

type HeroFixture = Omit<BlockView<"hero.page">, "image"> & { image: string }
type Variant = "home" | "page"

export const pageHero = (hero: HeroFixture): BlockView<"hero.page"> => ({
  ...hero,
  image: fromPath(hero.image),
})

export const heroHome = (): BlockView<"hero.home"> => ({
  ...HERO_CONTENT,
  members: {
    ...HERO_CONTENT.members,
    avatars: HERO_CONTENT.members.avatars.map(fromPath),
  },
})

export const credibility = (): BlockView<"credibility"> => ({
  badges: CREDENTIALS,
})
export const aboutIntro = (): BlockView<"about.intro"> => ABOUT_CONTENT

export const processBlock = (variant: Variant): BlockView<"process"> => ({
  variant,
  tag: variant === "page" ? HOW_IT_WORKS.page.tag : "",
  title: variant === "page" ? HOW_IT_WORKS.page.title : HOW_IT_WORKS.title,
  subtitle: HOW_IT_WORKS.subtitle,
  cta: HOW_IT_WORKS.cta,
})

export const processSteps = (): ProcessStepView[] =>
  STEPS.map((step, i) => ({
    id: `step-${i}`,
    title: step.title,
    description: step.description,
    image: fromPath(step.image),
    frame: cropToFrame(step.crop),
  }))

export const testimonialsBlock = (
  variant: Variant
): BlockView<"testimonials"> => ({
  variant,
  ...TESTIMONIALS_HEADER,
  selection: { mode: "all" },
})

export const testimonialItems = (): TestimonialView[] =>
  TESTIMONIALS.map((t, i) => ({
    id: `testimonial-${i}`,
    ...t,
    avatar: fromPath(t.avatar),
  }))

export const ctaBand = (key: "enterprise" | "about"): CtaBandView => {
  const band = key === "enterprise" ? ENTERPRISE_CONTENT : ABOUT_CTA
  return {
    id: `band-${key}`,
    ...band,
    bullets: [...band.bullets],
    image: fromPath(band.image),
  }
}

export const faqBlock = (variant: Variant): BlockView<"faq"> => ({
  variant,
  ...FAQ_HEADER,
  selection: { mode: "all" },
  initiallyOpen: 0,
})

export const faqItems = (): FaqView[] =>
  FAQS.map((faq, i) => ({ id: `faq-${i}`, ...faq }))

export const aboutStory = (): BlockView<"about.story"> => ({
  ...ABOUT_STORY,
  photo: fromPath(ABOUT_STORY.photo),
})
export const aboutStats = (): BlockView<"about.stats"> => ({
  stats: ABOUT_STATS,
})
export const aboutApproach = (): BlockView<"about.approach"> => ABOUT_APPROACH
export const aboutCredentials = (): BlockView<"about.credentials"> =>
  ABOUT_CREDENTIALS

// ---- Task 5: services, how it works, insights, article, contact ----

const service = (item: (typeof SERVICES.items)[number]): ServiceView => ({
  id: slugify(item.title),
  slug: slugify(item.title),
  ...item,
})

export const services = (): ServiceView[] => SERVICES.items.map(service)

export const plans = (): PlanView[] =>
  FORMATS.plans.map((plan) => ({
    id: slugify(plan.name),
    slug: slugify(plan.name),
    name: plan.name,
    priceLabel: plan.price,
    unit: plan.unit,
    summary: plan.summary,
    features: plan.features,
    ctaLabel: plan.cta.label,
    featured: "featured" in plan && plan.featured === true,
  }))

export const servicesGrid = (): BlockView<"services.grid"> => ({
  eyebrow: SERVICES.eyebrow,
  title: SERVICES.title,
  intro: SERVICES.intro,
  more: SERVICES.more,
})

export const servicesPlans = (): BlockView<"services.plans"> => ({
  eyebrow: FORMATS.eyebrow,
  title: FORMATS.title,
  subtitle: FORMATS.subtitle,
  featuredTag: FORMATS.featuredTag,
})

export const sessionTimeline = (): BlockView<"session.timeline"> => SESSION
export const fit = (): BlockView<"fit"> => FIT

// The closing CTA opens the contact form on the matching service.
const TOPIC_FOR: Partial<Record<Category, string>> = {
  "Anxiety & Stress": "anxiety-stress",
  Leadership: "performance-leadership",
  Sleep: "sleep-rest",
}

export const articleSummary = (a: Article): ArticleSummary => ({
  id: a.slug,
  slug: a.slug,
  title: a.title,
  excerpt: a.excerpt,
  image: fromPath(a.image),
  category: { slug: slugify(a.category), name: a.category },
  author: { name: a.author.name, avatar: fromPath(a.author.avatar) },
  date: a.date,
  readingMinutes: readingMinutes(plainText(toTipTap(getArticleBody(a.slug)))),
  featured: a.slug === FEATURED_ARTICLE.slug,
})

export const articleDetail = (article: Article): ArticleDetail => ({
  ...articleSummary(article),
  body: toTipTap(getArticleBody(article.slug)),
  topicSlug: TOPIC_FOR[article.category] ?? null,
})

export const categories = (): CategoryView[] =>
  CATEGORIES.map((name) => ({ id: slugify(name), slug: slugify(name), name }))

export const insightsLatest = (): BlockView<"insights.latest"> => ({
  ...INSIGHTS_HEADER,
  count: 3,
  selection: { mode: "all" },
})

export const insightsBrowser = (): BlockView<"insights.browser"> => ({
  heading: "Latest articles",
  pageSize: PAGE_SIZE,
})

export const newsletter = (): NewsletterView => ({
  ...NEWSLETTER,
  image: fromPath(NEWSLETTER.image),
})

export const contactDetails = (): BlockView<"contact.details"> => CONTACT_INFO

export const contactClinic = (): BlockView<"contact.clinic"> => ({
  ...CLINIC,
  photo: fromPath(CLINIC.photo),
})

export const contact = (): GlobalView<"contact"> => ({
  ...CONTACT,
  clinic: { ...CONTACT.clinic, photo: null },
})

export const contactForm = () => ({
  copy: CONTACT_FORM,
  topics: [
    ...SERVICES.items.map((s) => s.title),
    ...CONTACT_FORM.extraTopics,
  ].map((label): ContactOption => ({ slug: slugify(label), label })),
  formats: CONTACT_FORM.formats.map((label): ContactOption => ({
    slug: slugify(label),
    label,
  })),
  plans: plans().map((p): PlanOption => ({
    slug: p.slug,
    name: p.name,
    priceLabel: p.priceLabel,
    unit: p.unit,
  })),
})

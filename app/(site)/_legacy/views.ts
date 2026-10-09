// Transitional (Tasks 4–8): builds, from the old fixtures, exactly the props
// the database supplies from Task 9 on. Deleted in Task 9.
import type { BlockView } from "@/blocks/media-refs"
import { cropToFrame } from "@/lib/content/frame"
import type {
  CtaBandView,
  FaqView,
  ProcessStepView,
  TestimonialView,
} from "@/lib/content/types"
import { fromPath } from "@/lib/media"
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

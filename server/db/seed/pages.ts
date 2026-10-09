import "server-only"

import type { PageKind } from "@/blocks/define-block"
import { pageDocumentFor, type PageDocument } from "@/blocks/page"
import type { BlockData, BlockInstance, BlockType } from "@/blocks/registry"
import { ABOUT_CONTENT } from "@/server/db/seed/fixtures/about-content"
import {
  ABOUT_APPROACH,
  ABOUT_CREDENTIALS,
  ABOUT_HERO,
  ABOUT_STATS,
  ABOUT_STORY,
} from "@/server/db/seed/fixtures/about-page-content"
import {
  CLINIC,
  CONTACT_HERO,
  CONTACT_INFO,
} from "@/server/db/seed/fixtures/contact-content"
import { CREDENTIALS } from "@/server/db/seed/fixtures/credentials"
import { FAQ_HEADER } from "@/server/db/seed/fixtures/faqs"
import { HERO_CONTENT } from "@/server/db/seed/fixtures/hero-content"
import {
  FIT,
  HOW_IT_WORKS_HERO,
  SESSION,
} from "@/server/db/seed/fixtures/session"
import { HOW_IT_WORKS } from "@/server/db/seed/fixtures/steps"
import { INSIGHTS_HERO, PAGE_SIZE } from "@/server/db/seed/fixtures/articles"
import { INSIGHTS_HEADER } from "@/server/db/seed/fixtures/posts"
import {
  FORMATS,
  SERVICES,
  SERVICES_HERO,
} from "@/server/db/seed/fixtures/services-content"
import { TESTIMONIALS_HEADER } from "@/server/db/seed/fixtures/testimonials"
import type { Db } from "@/server/db/client"
import { pages } from "@/server/db/schema"

import { BAND_IDS } from "./collections"
import { seedId } from "./ids"
import { mediaRef } from "./media"

type Spec = {
  [T in BlockType]: {
    type: T
    anchor: string
    chapter: string | null
    data: BlockData<T>
    joinPrevious?: boolean
  }
}[BlockType]

type HeroFixture = {
  title: string
  subtitle: string
  image: string
  focal: { x: number; y: number } | null
  tint: number
  mirror: boolean
}

const ALL = { mode: "all" } as const
const hero = (h: HeroFixture): Spec => ({
  type: "hero.page",
  anchor: "home",
  chapter: "Welcome",
  data: { ...h, image: mediaRef(h.image) },
})
const faq = (variant: "home" | "page"): Spec => ({
  type: "faq",
  anchor: "faq",
  chapter: "FAQ",
  data: { variant, ...FAQ_HEADER, selection: ALL, initiallyOpen: 0 },
})
const processSpec = (variant: "home" | "page"): Spec => ({
  type: "process",
  anchor: "how-it-works",
  chapter: "Process",
  data: {
    variant,
    tag: variant === "page" ? HOW_IT_WORKS.page.tag : "",
    title: variant === "page" ? HOW_IT_WORKS.page.title : HOW_IT_WORKS.title,
    subtitle: HOW_IT_WORKS.subtitle,
    cta: HOW_IT_WORKS.cta,
  },
})
const band = (
  anchor: string,
  chapter: string,
  bandId: string,
  tint: number | null
): Spec => ({ type: "band", anchor, chapter, data: { bandId, tint } })

type PageSeed = {
  kind: PageKind
  path: string
  title: string
  description: string
  contact: boolean
  specs: Spec[]
}

// Today's composition, ids, chapter labels and tints (docs/brief.md §6.7 step 4).
export const SYSTEM_PAGES: PageSeed[] = [
  {
    kind: "home",
    path: "/",
    title: "Home",
    description: HERO_CONTENT.description,
    contact: true,
    specs: [
      {
        type: "hero.home",
        anchor: "home",
        chapter: "Welcome",
        data: {
          ...HERO_CONTENT,
          members: {
            ...HERO_CONTENT.members,
            avatars: HERO_CONTENT.members.avatars.map(mediaRef),
          },
        },
      },
      {
        type: "credibility",
        anchor: "credibility",
        chapter: null,
        data: { badges: CREDENTIALS },
      },
      {
        type: "about.intro",
        anchor: "about",
        chapter: "About",
        joinPrevious: true,
        data: ABOUT_CONTENT,
      },
      processSpec("home"),
      {
        type: "testimonials",
        anchor: "testimonials",
        chapter: "Stories",
        data: { variant: "home", ...TESTIMONIALS_HEADER, selection: ALL },
      },
      band("enterprise", "Organisations", BAND_IDS.enterprise, null),
      {
        type: "insights.latest",
        anchor: "insights",
        chapter: "Insights",
        data: { ...INSIGHTS_HEADER, count: 3, selection: ALL },
      },
      faq("home"),
    ],
  },
  {
    kind: "about",
    path: "/about",
    title: ABOUT_HERO.title,
    description: ABOUT_HERO.subtitle,
    contact: true,
    specs: [
      hero(ABOUT_HERO),
      {
        type: "about.story",
        anchor: "story",
        chapter: "Story",
        data: { ...ABOUT_STORY, photo: mediaRef(ABOUT_STORY.photo) },
      },
      {
        type: "about.stats",
        anchor: "practice-in-numbers",
        chapter: null,
        joinPrevious: true,
        data: { stats: ABOUT_STATS },
      },
      {
        type: "about.approach",
        anchor: "approach",
        chapter: "Approach",
        data: ABOUT_APPROACH,
      },
      {
        type: "about.credentials",
        anchor: "credentials",
        chapter: "Credentials",
        data: ABOUT_CREDENTIALS,
      },
      {
        type: "testimonials",
        anchor: "testimonials",
        chapter: "Stories",
        data: { variant: "page", ...TESTIMONIALS_HEADER, selection: ALL },
      },
      band("next-step", "Next step", BAND_IDS.about, 0.7),
    ],
  },
  {
    kind: "services",
    path: "/services",
    title: SERVICES_HERO.title,
    description: SERVICES_HERO.subtitle,
    contact: true,
    specs: [
      hero(SERVICES_HERO),
      {
        type: "services.grid",
        anchor: "services",
        chapter: "Services",
        data: {
          eyebrow: SERVICES.eyebrow,
          title: SERVICES.title,
          intro: SERVICES.intro,
          more: SERVICES.more,
        },
      },
      {
        type: "services.plans",
        anchor: "formats",
        chapter: "Formats",
        data: {
          eyebrow: FORMATS.eyebrow,
          title: FORMATS.title,
          subtitle: FORMATS.subtitle,
          featuredTag: FORMATS.featuredTag,
        },
      },
      band("enterprise", "Organisations", BAND_IDS.enterprise, null),
      faq("page"),
    ],
  },
  {
    kind: "how-it-works",
    path: "/how-it-works",
    title: HOW_IT_WORKS_HERO.title,
    description: HOW_IT_WORKS_HERO.subtitle,
    contact: true,
    specs: [
      hero(HOW_IT_WORKS_HERO),
      processSpec("page"),
      {
        type: "session.timeline",
        anchor: "session",
        chapter: "A session",
        data: SESSION,
      },
      { type: "fit", anchor: "fit", chapter: "Fit", data: FIT },
      faq("page"),
      band("next-step", "Next step", BAND_IDS.about, null),
    ],
  },
  {
    kind: "insights",
    path: "/insights",
    title: INSIGHTS_HERO.title,
    description: INSIGHTS_HERO.subtitle,
    contact: true,
    specs: [
      hero(INSIGHTS_HERO),
      {
        type: "insights.browser",
        anchor: "articles",
        chapter: "Articles",
        data: { heading: "Latest articles", pageSize: PAGE_SIZE },
      },
      {
        type: "newsletter",
        anchor: "newsletter",
        chapter: "Newsletter",
        data: { override: null },
      },
    ],
  },
  {
    kind: "contact",
    path: "/contact",
    title: CONTACT_HERO.title,
    description: CONTACT_HERO.subtitle,
    contact: false,
    specs: [
      hero(CONTACT_HERO),
      {
        type: "contact.details",
        anchor: "get-in-touch",
        chapter: "Get in touch",
        data: CONTACT_INFO,
      },
      {
        type: "contact.clinic",
        anchor: "clinic",
        chapter: "Clinic",
        data: {
          eyebrow: CLINIC.eyebrow,
          title: CLINIC.title,
          subtitle: CLINIC.subtitle,
          photo: mediaRef(CLINIC.photo),
        },
      },
      faq("home"),
    ],
  },
]

// Footer links point here; until an editor writes real copy and publishes,
// they stay drafts and keep answering 404 (as they do today).
export const LEGAL_PAGES: PageSeed[] = [
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms"],
  ["/disclaimer", "Disclaimer"],
].map(([path, title]) => ({
  kind: "custom",
  path,
  title,
  description: "",
  contact: true,
  specs: [
    hero({
      title,
      subtitle: "Placeholder copy: replace before launch.",
      image: "/images/hero/hero-bg.png",
      focal: null,
      tint: 0.32,
      mirror: false,
    }),
    {
      type: "richtext",
      anchor: "content",
      chapter: null,
      data: {
        doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: `This ${title.toLowerCase()} is a placeholder and has not been reviewed.`,
                },
              ],
            },
          ],
        },
        width: "narrow",
      },
    },
  ],
}))

const documentOf = (seed: PageSeed): PageDocument =>
  // Throws on a fixture the registry rejects: this is the fixture validation.
  pageDocumentFor(seed.kind).parse({
    blocks: seed.specs.map(
      (spec): BlockInstance =>
        ({
          id: `${seed.kind}-${spec.anchor}`,
          hidden: false,
          ...spec,
          joinPrevious: spec.joinPrevious ?? false,
        }) as BlockInstance
    ),
  })

export async function seedPages(db: Db) {
  const rows = [...SYSTEM_PAGES, ...LEGAL_PAGES].map((seed) => {
    const document = documentOf(seed)
    const live = seed.kind !== "custom"
    return {
      id: seedId("page", seed.path),
      systemKey: live ? seed.kind : null,
      path: seed.path,
      title: seed.title,
      status: live ? ("published" as const) : ("draft" as const),
      draft: document,
      published: live ? document : null,
      seo: { description: seed.description || null },
      settings: { showContactChapter: seed.contact, needsReview: !live },
      publishedAt: live ? new Date() : null,
    }
  })
  await db.insert(pages).values(rows).onConflictDoNothing()
  return rows.length
}

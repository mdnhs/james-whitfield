// blocks/service-template.ts
import type { PageDocument } from "./page"
import type { BlockInstance } from "./registry"

type Service = { slug: string; title: string; body: string }

// Cut to a field's limit at a word boundary, so long service copy still
// produces a page that publishes.
function fit(value: string, max: number) {
  const text = value.trim().replace(/\s+/g, " ")
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`
}

const BOOK = { label: "Book a discovery call", href: "/contact" }

const block = <B extends BlockInstance>(
  b: Omit<B, "id" | "hidden" | "joinPrevious">
) =>
  ({
    id: crypto.randomUUID(),
    hidden: false,
    joinPrevious: false,
    ...b,
  }) as B

// The fixed layout of a service detail page (/services/<slug>): seven
// sections in this order, filled with placeholder copy from the service that
// the editor then rewrites. The hero is "home" like every hero
// (pageDocumentFor); the rest are the anchors the journey rail links to.
export function serviceTemplate(
  service: Service,
  bandId: string,
  heroImageId: string
): PageDocument {
  const title = fit(service.title, 40)
  const name = fit(service.title, 60)
  const summary = fit(service.body || service.title, 200)

  return {
    blocks: [
      block<Extract<BlockInstance, { type: "hero.page" }>>({
        type: "hero.page",
        anchor: "home",
        chapter: null,
        data: {
          title,
          subtitle: summary,
          image: { mediaId: heroImageId },
          focal: null,
          tint: 0.3,
          mirror: false,
          cta: BOOK,
        },
      }),
      block<Extract<BlockInstance, { type: "service.intro" }>>({
        type: "service.intro",
        anchor: "about",
        chapter: "Overview",
        data: {
          eyebrow: "What it is",
          title: fit(`What ${name} is`, 80),
          body: `${fit(service.body || service.title, 900)}\n\nDescribe how sessions for ${name} work, what clients notice and what makes this approach different.`,
          forYouHeading: "This is for you if",
          forYou: [
            "You want practical change, not just talk",
            "You are ready to try something new",
            "You would like support between sessions",
          ],
        },
      }),
      block<Extract<BlockInstance, { type: "service.benefits" }>>({
        type: "service.benefits",
        anchor: "benefits",
        chapter: "Benefits",
        data: {
          eyebrow: "Benefits",
          title: fit(`What ${name} can change`, 80),
          items: [
            {
              icon: "evidence",
              title: "Evidence-based",
              body: "Methods drawn from clinical research, explained plainly.",
            },
            {
              icon: "control",
              title: "You stay in control",
              body: "Every session is collaborative and goes at your pace.",
            },
            {
              icon: "real-life",
              title: "Built for real life",
              body: "Tools you can use at home, at work and on the move.",
            },
          ],
        },
      }),
      block<Extract<BlockInstance, { type: "journey" }>>({
        type: "journey",
        anchor: "sessions",
        chapter: "Sessions",
        data: {
          eyebrow: "How sessions work",
          title: "From first call to lasting change",
          steps: [
            {
              title: "Discovery call",
              body: "A free conversation about what you want to change.",
              tag: "Free · 20 min",
            },
            {
              title: "First session",
              body: "We map your goals and begin the work together.",
              tag: "60–90 min",
            },
            {
              title: "Follow-up sessions",
              body: "Focused sessions that build on each other.",
              tag: "Weekly",
            },
          ],
          cta: BOOK,
        },
      }),
      block<Extract<BlockInstance, { type: "service.formats" }>>({
        type: "service.formats",
        anchor: "formats",
        chapter: "Formats",
        data: {
          eyebrow: "Formats & investment",
          title: "Choose the format that suits you",
          subtitle: "Clear pricing, no long contracts.",
          featuredTag: "Most popular",
          plans: [
            {
              name: "Single session",
              priceLabel: "€120",
              unit: "per session",
              summary: "One focused session to start.",
              features: ["60–90 minutes", "In person or online"],
              ctaLabel: "Book a session",
              featured: false,
            },
            {
              name: "Programme",
              priceLabel: "€450",
              unit: "4 sessions",
              summary: "A structured programme with support in between.",
              features: ["4 sessions", "Recordings to use at home"],
              ctaLabel: "Start the programme",
              featured: true,
            },
          ],
        },
      }),
      block<Extract<BlockInstance, { type: "service.faq" }>>({
        type: "service.faq",
        anchor: "faq",
        chapter: "FAQ",
        data: {
          title: "Frequently asked questions",
          subtitle: fit(`What people often ask about ${name}.`, 200),
          items: [
            {
              question: "How many sessions will I need?",
              answer:
                "It depends on what you want to change. We agree a plan at your first session.",
            },
            {
              question: "Can sessions be online?",
              answer: "Yes. Sessions run in person or by secure video call.",
            },
          ],
          initiallyOpen: 0,
        },
      }),
      block<Extract<BlockInstance, { type: "band" }>>({
        type: "band",
        anchor: "book",
        chapter: null,
        data: { bandId, tint: null },
      }),
    ],
  }
}

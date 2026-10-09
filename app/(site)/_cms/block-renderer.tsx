import { JourneyRail } from "@/components/journey-rail"
import { PageMotion } from "@/components/page-motion"
import { StackCard } from "@/components/stack-card"
import { groupCards, pageChapters } from "@/lib/content/page-layout"
import type { PublishedPage } from "@/lib/content/types"

import { ResolvedBlock } from "./resolve-block"

// Cards, rail and motion for one page (docs/brief.md §5.7). `key` remounts the
// page root if two paths ever render through one segment (Phase 4's custom
// pages), so the rail and PageMotion rebuild instead of keeping old chapters.
export function BlockRenderer({
  page,
  contactLabel,
}: {
  page: PublishedPage
  contactLabel: string
}) {
  const { blocks } = page.document
  const cards = groupCards(blocks)
  return (
    <main key={page.path} data-page-root className="bg-ink">
      {cards.map((card, i) => (
        <StackCard
          key={card[0].id}
          id={i === 0 ? "home" : undefined}
          rounded={i !== 0}
          last={i === cards.length - 1}
        >
          {card.map((block) => (
            <ResolvedBlock key={block.id} block={block} />
          ))}
        </StackCard>
      ))}
      <JourneyRail
        chapters={pageChapters(
          blocks,
          page.settings.showContactChapter ? contactLabel : null
        )}
      />
      <PageMotion />
    </main>
  )
}

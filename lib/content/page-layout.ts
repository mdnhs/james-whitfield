import type { Chapter } from "./types"

type Placed = {
  anchor: string
  chapter: string | null
  hidden: boolean
  joinPrevious: boolean
}

// Consecutive joinPrevious blocks share one StackCard (docs/brief.md §6.2).
export function groupCards<T extends Placed>(blocks: T[]): T[][] {
  const cards: T[][] = []
  for (const block of blocks) {
    if (block.hidden) continue
    const last = cards.at(-1)
    if (block.joinPrevious && last) last.push(block)
    else cards.push([block])
  }
  return cards
}

// JourneyRail chapters come from the blocks (§5.7 rule 8). The first card is
// #home; "Contact" targets the footer, which lives in the layout.
export function pageChapters(
  blocks: Placed[],
  contactLabel: string | null
): Chapter[] {
  const chapters = blocks
    .filter((block) => !block.hidden)
    .flatMap((block, i) =>
      block.chapter
        ? [{ label: block.chapter, target: i === 0 ? "home" : block.anchor }]
        : []
    )
  if (contactLabel) chapters.push({ label: contactLabel, target: "contact" })
  return chapters
}

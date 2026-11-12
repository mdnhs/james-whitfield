// A page's structure is fixed: editors change block content, never which
// blocks exist, their order, anchors or visibility. `id`, `chapter`,
// `joinPrevious` and `data` are content and not locked.
export type BlockShape = { type: string; anchor: string; hidden: boolean }

type HasBlocks = { blocks: readonly BlockShape[] }

export function structureOf(doc: HasBlocks): BlockShape[] {
  return doc.blocks.map(({ type, anchor, hidden }) => ({
    type,
    anchor,
    hidden,
  }))
}

export function sameStructure(a: HasBlocks, b: HasBlocks): boolean {
  if (a.blocks.length !== b.blocks.length) return false
  return a.blocks.every((block, i) => {
    const other = b.blocks[i]!
    return (
      block.type === other.type &&
      block.anchor === other.anchor &&
      block.hidden === other.hidden
    )
  })
}

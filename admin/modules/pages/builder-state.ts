import { emptyValueFor } from "@/admin/components/schema-form/to-fields"
import type { PageKind } from "@/blocks/define-block"
import type { DraftBlock, DraftDocument } from "@/blocks/page"
import { BLOCK_BY_TYPE, BLOCKS, type BlockType } from "@/blocks/registry"

export type BlockMetaPatch = Partial<
  Pick<DraftBlock, "anchor" | "chapter" | "hidden" | "joinPrevious">
>

export type DocAction =
  | { type: "add"; blockType: BlockType }
  | { type: "remove"; id: string }
  | { type: "move"; from: number; to: number }
  | { type: "data"; id: string; data: Record<string, unknown> }
  | { type: "meta"; id: string; patch: BlockMetaPatch }

const isHero = (type: BlockType) => type === "hero.home" || type === "hero.page"

function uniqueAnchor(base: string, doc: DraftDocument) {
  const taken = new Set(doc.blocks.map((block) => block.anchor))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

// New blocks get a uuid id (BlockId accepts it) and a structurally complete,
// not yet valid, data object; the form then shows what is missing.
export function newBlock(type: BlockType, doc: DraftDocument): DraftBlock {
  return {
    id: crypto.randomUUID(),
    type,
    anchor: isHero(type) ? "home" : uniqueAnchor(type.replace(/\./g, "-"), doc),
    chapter: null,
    hidden: false,
    joinPrevious: false,
    data: emptyValueFor(BLOCK_BY_TYPE[type].schema) as Record<string, unknown>,
  }
}

// The placement rules of pageDocumentFor, so the library only offers blocks
// that can be published here.
export function addableTypes(kind: PageKind, doc: DraftDocument): BlockType[] {
  return BLOCKS.filter((def) => {
    if (def.allowedOn !== "*" && !def.allowedOn.includes(kind)) return false
    const count = doc.blocks.filter((block) => block.type === def.type).length
    if (def.max !== undefined && count >= def.max) return false
    if (
      def.first &&
      doc.blocks.some((block) => BLOCK_BY_TYPE[block.type].first)
    )
      return false
    return true
  }).map((def) => def.type)
}

export function docReducer(
  doc: DraftDocument,
  action: DocAction
): DraftDocument {
  switch (action.type) {
    case "add": {
      const block = newBlock(action.blockType, doc)
      return {
        blocks: BLOCK_BY_TYPE[action.blockType].first
          ? [block, ...doc.blocks]
          : [...doc.blocks, block],
      }
    }
    case "remove":
      return { blocks: doc.blocks.filter((block) => block.id !== action.id) }
    case "move": {
      const blocks = [...doc.blocks]
      const [moved] = blocks.splice(action.from, 1)
      if (!moved) return doc
      blocks.splice(action.to, 0, moved)
      return { blocks }
    }
    case "data":
      return {
        blocks: doc.blocks.map((block) =>
          block.id === action.id ? { ...block, data: action.data } : block
        ),
      }
    case "meta":
      return {
        blocks: doc.blocks.map((block) =>
          block.id === action.id ? { ...block, ...action.patch } : block
        ),
      }
  }
}

// Publish errors arrive as "blocks.<i>.<path>" (server/api/errors.ts).
export function errorsByBlock(
  fieldErrors: Record<string, string[]>,
  doc: DraftDocument
) {
  const out = new Map<string, Record<string, string[]>>()
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const match = /^blocks\.(\d+)\.(.+)$/.exec(path)
    const block = match ? doc.blocks[Number(match[1])] : undefined
    if (!match || !block) continue
    const rest = match[2]!
    const key = rest.startsWith("data.")
      ? rest.slice("data.".length)
      : `$${rest}`
    out.set(block.id, { ...out.get(block.id), [key]: messages })
  }
  return out
}

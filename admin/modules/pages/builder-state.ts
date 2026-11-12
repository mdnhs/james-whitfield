import type { DraftBlock, DraftDocument } from "@/blocks/page"

export type BlockMetaPatch = Partial<Pick<DraftBlock, "chapter">>

// Editors change content only: the page's sections are fixed by the server.
export type DocAction =
  | { type: "data"; id: string; data: Record<string, unknown> }
  | { type: "meta"; id: string; patch: BlockMetaPatch }

export function docReducer(
  doc: DraftDocument,
  action: DocAction
): DraftDocument {
  switch (action.type) {
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

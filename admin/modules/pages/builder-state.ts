import type { DraftBlock, DraftDocument } from "@/blocks/page"
import { BLOCK_BY_TYPE } from "@/blocks/registry"

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

// The block a failed publish selects: the first erroneous one the outline
// shows. A hidden block is never selected; with none, nothing is.
export function firstVisibleErrorBlock(
  errors: ReadonlyMap<string, unknown>,
  doc: DraftDocument
) {
  return (
    doc.blocks.find((block) => !block.hidden && errors.has(block.id))?.id ??
    null
  )
}

export type PublishProblem = { text: string; developer: boolean }

// Every publish error, worded for the page-level banner. Editors can fix a
// visible block's content; anything else (a hidden block, an anchor or other
// section setting, an error tied to no block) needs a developer.
export function publishProblems(
  fieldErrors: Record<string, string[]>,
  doc: DraftDocument
): PublishProblem[] {
  const out: PublishProblem[] = []
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const match = /^blocks\.(\d+)\.(.+)$/.exec(path)
    const block = match ? doc.blocks[Number(match[1])] : undefined
    const label = block
      ? `${BLOCK_BY_TYPE[block.type]?.label ?? block.type}${block.hidden ? " (hidden section)" : ""}: `
      : ""
    const developer = !block || block.hidden || !match![2]!.startsWith("data.")
    for (const message of messages) {
      out.push({ text: `${label}${message}`, developer })
    }
  }
  return out
}

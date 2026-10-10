// One string per text block (paragraph, heading), joined by spaces: the same
// words the Phase 3 helper counted, so reading times do not move. Tolerant of
// half-typed drafts: the editor shows it live (docs/brief.md §9.3).
type Json = { type?: string; text?: string; content?: unknown[] }
const TEXT_BLOCKS = new Set(["paragraph", "heading"])

export function plainText(doc: unknown): string {
  const blocks: string[] = []
  const inline = (node: Json): string =>
    node.type === "text"
      ? (node.text ?? "")
      : (node.content ?? []).map((c) => inline(c as Json)).join("")
  const walk = (node: Json) => {
    if (node.type && TEXT_BLOCKS.has(node.type)) blocks.push(inline(node))
    else for (const child of node.content ?? []) walk(child as Json)
  }
  if (doc && typeof doc === "object") walk(doc as Json)
  return blocks.join(" ")
}

export const readingMinutes = (value: string) =>
  Math.max(1, Math.round(value.split(/\s+/).length / 220))

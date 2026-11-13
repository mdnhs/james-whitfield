import { parseAsStringLiteral, useQueryState } from "nuqs"

export type EditorTab = "card" | "content" | "seo"

// The editors keep their tab in ?tab=, so the SEO center's "Fix" links
// open the SEO tab directly. "card" exists only where an editor has one (a
// service's own editor); elsewhere it reads as "content".
export function useEditorTab({ card = false }: { card?: boolean } = {}) {
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(["card", "content", "seo"] as const).withDefault(
      card ? "card" : "content"
    )
  )
  return [!card && tab === "card" ? "content" : tab, setTab] as const
}

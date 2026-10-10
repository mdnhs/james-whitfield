import { parseAsStringLiteral, useQueryState } from "nuqs"

// The editors keep their tab in ?tab=, so the SEO center's "Fix" links
// open the SEO tab directly.
export function useEditorTab() {
  return useQueryState(
    "tab",
    parseAsStringLiteral(["content", "seo"] as const).withDefault("content")
  )
}

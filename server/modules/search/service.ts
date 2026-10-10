import "server-only"

import { reachableLinks } from "@/lib/admin/nav"
import type { RoleName } from "@/lib/auth/permissions"
import { matchesSearch, normaliseSearch } from "@/lib/search/normalize"

export { normaliseSearch }

// Navigation and articles; enquiries and media join in later phases
// (docs/brief.md §9.4).
export type SearchHit = {
  id: string
  kind: "page" | "article"
  label: string
  href: string
}

export function searchNavigation(
  roles: readonly RoleName[],
  q: string
): SearchHit[] {
  return reachableLinks(roles)
    .filter((link) =>
      matchesSearch(q, [
        link.label,
        link.parent ?? "",
        ...(link.keywords ?? []),
      ])
    )
    .map((link) => ({
      id: `nav:${link.id}`,
      kind: "page" as const,
      label: link.parent ? `${link.parent} › ${link.label}` : link.label,
      href: link.href,
    }))
}

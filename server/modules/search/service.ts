import "server-only"

import { reachableLinks } from "@/lib/admin/nav"
import type { RoleName } from "@/lib/auth/permissions"
import { matchesSearch, normaliseSearch } from "@/lib/search/normalize"

export { normaliseSearch }

// Navigation hits only in Phase 2; later phases add pages, articles,
// enquiries and media as further sources (docs/brief.md §9.4).
export type SearchHit = {
  id: string
  kind: "page"
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

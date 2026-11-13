import "server-only"

import { helpHref, searchHelp } from "@/lib/admin/help/registry"
import { reachableLinks } from "@/lib/admin/nav"
import type { RoleName } from "@/lib/auth/permissions"
import { matchesSearch, normaliseSearch } from "@/lib/search/normalize"

export { normaliseSearch }

// Navigation and articles; enquiries and media join in later phases
// (docs/brief.md §9.4).
export type SearchHit = {
  id: string
  kind: "page" | "article" | "help"
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

// The admin's help articles the caller may read, matched on title,
// description and keywords. Only for a typed query: an empty palette lists
// the screens, not thirty guides.
export function searchHelpHits(
  roles: readonly RoleName[],
  q: string
): SearchHit[] {
  return searchHelp(roles, q).map((article) => ({
    id: `help:${article.slug}`,
    kind: "help" as const,
    label: article.title,
    href: helpHref(article.slug),
  }))
}

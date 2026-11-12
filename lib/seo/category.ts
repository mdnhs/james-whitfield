import { PageSeo } from "@/blocks/page"
import { categoryHref } from "@/lib/content/category-href"
import type { CategoryDetail } from "@/lib/content/types"

import type { SeoSubject } from "./metadata"

// A category hub's metadata input: seoTitle/seoDescription override the name
// and description (buildMetadata falls back through title/summary); blank
// strings count as unset.
export function categorySubject(c: CategoryDetail): SeoSubject {
  return {
    path: categoryHref(c.slug),
    home: false,
    kind: "page",
    title: c.name,
    summary: c.description,
    eyebrow: null,
    seo: PageSeo.parse({
      title: c.seoTitle || null,
      description: c.seoDescription || null,
    }),
    ogImage: null,
  }
}

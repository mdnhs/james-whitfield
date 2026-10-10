import type { SeoDefaults } from "@/lib/seo/metadata"
import { getSetting } from "@/server/modules/content/queries"

// Callers have awaited io(); both reads are cached and tagged.
export async function seoDefaults(): Promise<SeoDefaults> {
  const [seo, site] = await Promise.all([getSetting("seo"), getSetting("site")])
  return {
    titleTemplate: seo.titleTemplate,
    defaultTitle: seo.defaultTitle,
    defaultDescription: seo.defaultDescription,
    siteName: site.name,
    professionalTitle: site.professionalTitle,
  }
}

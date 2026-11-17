import { siteOriginFor } from "@/lib/seo/canonical-host"
import { getEnv } from "@/server/env"
import { getSetting } from "@/server/modules/content/queries"

// The public origin on the admin's preferred address (SEO defaults). The seo
// setting is cached and revalidated on save, so changing the choice updates
// canonicals, the sitemap and structured data without a redeploy.
export async function getSiteOrigin(): Promise<string> {
  const seo = await getSetting("seo")
  return siteOriginFor(getEnv().SITE_URL, seo.preferredHost)
}

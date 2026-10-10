"use client"

import { useQuery } from "@tanstack/react-query"

import { globalQuery } from "@/admin/modules/globals/queries"
import { themeColorsQuery } from "@/admin/modules/appearance/queries"
import { mediaListQuery } from "@/admin/modules/media/queries"
import type { GlobalValue } from "@/lib/content/globals"
import { blank } from "@/lib/seo/metadata"
import { ogColors } from "@/lib/seo/og-theme"
import { documentTitle } from "@/lib/seo/title"
import { DEFAULT_THEME } from "@/lib/theme/schema"

import { SeoChecklist } from "./seo-checklist"
import type { SeoMetaValues } from "./seo-fields"
import { SerpPreview, serpUrl } from "./serp-preview"
import { SocialCard } from "./social-card"

const CARD = "rounded-card flex flex-col gap-4 bg-card p-5 sm:p-6"

// The live side of both SEO tabs: what a search result and a shared link
// will look like for the values being typed. Defaults come from the `seo`
// and `site` globals; a role that cannot read them falls back to empty.
export function SeoAside({
  path,
  fallbackTitle,
  summary,
  eyebrow,
  values,
}: {
  path: string
  // The page or article title, used when the SEO title is empty.
  fallbackTitle: string
  // Used when the meta description is empty (an article's excerpt).
  summary?: string
  // The card's small line: an article's category. Pages use the site's
  // professional title.
  eyebrow?: string
  values: SeoMetaValues
}) {
  const seo = useQuery({ ...globalQuery("seo"), retry: false })
  const site = useQuery({ ...globalQuery("site"), retry: false })
  const media = useQuery({
    ...mediaListQuery({ ids: values.ogImage ? [values.ogImage.mediaId] : [] }),
    enabled: Boolean(values.ogImage),
  })
  const colors = useQuery(themeColorsQuery()).data
  const defaults = seo.data?.value as GlobalValue<"seo"> | undefined
  const image = values.ogImage ? media.data?.items[0] : undefined
  const host =
    typeof window === "undefined" ? "" : window.location.host.split(":")[0]!

  const title = documentTitle(
    {
      home: path === "/",
      title: fallbackTitle,
      seoTitle: values.seoTitle || null,
    },
    {
      titleTemplate: defaults?.titleTemplate ?? "",
      defaultTitle: defaults?.defaultTitle ?? "",
    }
  )
  // The default description is left out of the checks: the SEO center does
  // not count it as passing either.
  const own = blank(values.description) ?? summary ?? ""
  const description = own || defaults?.defaultDescription || ""
  const ogTitle = blank(values.ogTitle) ?? title
  const ogDescription = values.ogDescription || description
  const siteValue = site.data?.value as GlobalValue<"site"> | undefined
  const card = {
    title: blank(values.ogTitle) ?? title,
    eyebrow: eyebrow ?? siteValue?.professionalTitle ?? "",
    siteName: siteValue?.name ?? "",
    // Phase 7 carry: the share card uses the published theme colours.
    colors: colors ?? ogColors(DEFAULT_THEME.site),
  }

  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-4 lg:self-start">
      <section aria-labelledby="serp-heading" className={CARD}>
        <h2 id="serp-heading" className="text-card-title">
          In search results
        </h2>
        <SerpPreview
          url={serpUrl(host, path)}
          title={title}
          description={description}
        />
      </section>
      <section aria-labelledby="share-heading" className={CARD}>
        <h2 id="share-heading" className="text-card-title">
          When shared
        </h2>
        <SocialCard
          siteHost={host}
          title={ogTitle}
          description={ogDescription}
          imageSrc={image?.url}
          card={card}
        />
      </section>
      <section aria-labelledby="checks-heading" className={CARD}>
        <h2 id="checks-heading" className="text-card-title">
          Checks
        </h2>
        <SeoChecklist
          input={{
            title,
            titleUnique: true,
            description: own,
            ogImage:
              image?.width && image.height
                ? { width: image.width, height: image.height }
                : null,
            imagesMissingAlt: 0,
            hasH1: true,
            noindex: values.noindex,
            internalLinks: 0,
          }}
        />
      </section>
    </aside>
  )
}

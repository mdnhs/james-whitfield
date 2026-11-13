"use client"

import { subnavIcon } from "@/admin/components/shell/nav-icons"
import { GlobalEditor } from "@/admin/modules/globals/global-editor"

import { CrawlPreview } from "./crawl-preview"

// Ruling R10: the defaults are the `seo` global; this page adds what
// crawlers actually receive from them.
export function SeoDefaultsView() {
  return (
    <div className="flex flex-col gap-8">
      <GlobalEditor
        title="SEO defaults"
        icon={subnavIcon("seo-defaults")}
        description="Fallback titles, share image and search settings."
        keys={["seo"]}
      />
      <CrawlPreview />
    </div>
  )
}

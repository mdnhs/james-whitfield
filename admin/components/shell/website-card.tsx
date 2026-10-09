import { ExternalLinkIcon } from "lucide-react"

import { Swirl } from "@/admin/components/swirl"
import { Button } from "@/components/ui/button"

// The inspiration's "Download our Mobile App" slot, as "Your website"
// (docs/brief.md §9.1). Phase 4 adds "Preview drafts" next to "Open site".
export function WebsiteCard({ siteUrl }: { siteUrl: string }) {
  return (
    <div className="bg-promo relative isolate overflow-hidden rounded-[18px] p-5 group-data-[collapsible=icon]:hidden">
      <Swirl className="absolute inset-0 -z-10 size-full" />
      <p className="flex items-center gap-2 text-xs font-medium opacity-80">
        <span aria-hidden className="size-2 rounded-full bg-chart-3" />
        Live
      </p>
      <p className="mt-3 text-lg leading-tight font-semibold">Your website</p>
      <p className="mt-1 truncate text-xs opacity-75">
        {new URL(siteUrl).host}
      </p>
      <Button
        nativeButton={false}
        render={<a href={siteUrl} target="_blank" rel="noreferrer" />}
        className="mt-4 h-11 w-full rounded-xl font-semibold"
      >
        Open site
        <ExternalLinkIcon data-icon="inline-end" />
        <span className="sr-only"> (opens in a new tab)</span>
      </Button>
    </div>
  )
}

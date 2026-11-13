import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { PageBuilderSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { InsightsTabs } from "@/admin/modules/insights/insights-tabs"
import { PageBuilder } from "@/admin/modules/pages/page-builder"
import { isWebsiteKey, WEBSITE_PAGES, websiteHref } from "@/lib/admin/website"
import { requireActor, requirePermission } from "@/server/auth/session"
import { findPageIdBySystemKey } from "@/server/modules/pages/service"

export const metadata: Metadata = { title: "Website" }

// legal and header-footer are their own routes; these are the page screens.
export function generateStaticParams() {
  return WEBSITE_PAGES.map((page) => ({ key: page.key }))
}

export default function WebsitePage({
  params,
}: PageProps<"/admin/website/[key]">) {
  return (
    <Suspense fallback={<PageBuilderSkeleton />}>
      <Gate params={params} />
    </Suspense>
  )
}

async function Gate({
  params,
}: {
  params: PageProps<"/admin/website/[key]">["params"]
}) {
  // Read first, as in pages/[id]: the segment cache keys on params read.
  const { key } = await params
  const path = isWebsiteKey(key) ? websiteHref(key) : `/admin/website/${key}`
  // Signed in before the 404, so a stranger never learns which paths exist.
  await requireActor(path)
  if (!isWebsiteKey(key)) notFound()
  await requirePermission({ page: ["read"] }, path)
  const systemKey = WEBSITE_PAGES.find((page) => page.key === key)!.systemKey
  const id = await findPageIdBySystemKey(systemKey)
  if (!id) notFound()
  const builder = <PageBuilder id={id} />
  return key === "insights" ? (
    <div className="flex flex-col gap-6">
      <InsightsTabs />
      {builder}
    </div>
  ) : (
    builder
  )
}

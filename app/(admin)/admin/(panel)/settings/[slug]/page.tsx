import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { GlobalEditor } from "@/admin/modules/globals/global-editor"
import { linkForPath } from "@/lib/admin/nav"
import { SETTINGS_PAGES, type SettingsPage } from "@/lib/content/global-access"
import { requireActor, requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Site settings" }

export default function SettingsSlugPage({
  params,
}: PageProps<"/admin/settings/[slug]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate params={params} />
    </Suspense>
  )
}

async function Gate({
  params,
}: {
  params: PageProps<"/admin/settings/[slug]">["params"]
}) {
  const { slug } = await params
  const path = `/admin/settings/${slug}`
  await requireActor(path)
  const link = linkForPath(path)
  if (!link || !Object.hasOwn(SETTINGS_PAGES, slug)) notFound()
  await requirePermission(link.permission, path)
  return (
    <GlobalEditor
      title={link.label}
      keys={SETTINGS_PAGES[slug as SettingsPage]}
    />
  )
}

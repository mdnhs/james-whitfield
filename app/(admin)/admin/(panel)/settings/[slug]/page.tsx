import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { GlobalEditorPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { subnavIcon } from "@/admin/components/shell/nav-icons"
import { GlobalEditor } from "@/admin/modules/globals/global-editor"
import { linkForPath } from "@/lib/admin/nav"
import { SETTINGS_PAGES, type SettingsPage } from "@/lib/content/global-access"
import { requireActor, requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Site settings" }

// One short line under each title; field help sits behind info icons.
const BLURBS: Partial<Record<SettingsPage, string>> = {
  identity: "Name, logo and social profiles.",
  contact: "Phone, email, address and hours.",
  forms: "Form labels, messages and small print.",
  notifications: "Enquiry emails and the auto-reply.",
  privacy: "How long data is kept.",
  chat: "The chat bubble on the site.",
}

export default function SettingsSlugPage({
  params,
}: PageProps<"/admin/settings/[slug]">) {
  return (
    <Suspense fallback={<GlobalEditorPageSkeleton />}>
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
      icon={subnavIcon(link.id)}
      description={BLURBS[slug as SettingsPage]}
      keys={SETTINGS_PAGES[slug as SettingsPage]}
    />
  )
}

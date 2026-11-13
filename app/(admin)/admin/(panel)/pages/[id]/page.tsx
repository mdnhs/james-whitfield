import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import * as z from "zod"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { PageBuilder } from "@/admin/modules/pages/page-builder"
import { requirePermission } from "@/server/auth/session"
import { serviceOfPage } from "@/server/modules/service-pages/service"

export const metadata: Metadata = { title: "Edit page" }

// A placeholder so the build sees the param (rejected by the uuid check).
export function generateStaticParams() {
  return [{ id: "__shell" }]
}

export default function EditPage({ params }: PageProps<"/admin/pages/[id]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate params={params} />
    </Suspense>
  )
}

async function Gate({
  params,
}: {
  params: PageProps<"/admin/pages/[id]">["params"]
}) {
  // Read first: Next keys the client segment cache by the params the server
  // saw read, and the auth check below is a dynamic boundary that would end
  // the render before `id` was recorded (the segment then matched any id).
  const { id } = await params
  await requirePermission({ page: ["read"] })
  if (!z.uuid().safeParse(id).success) notFound()
  // A service's page is edited with the service (card, content, SEO).
  const serviceId = await serviceOfPage(id)
  if (serviceId) redirect(`/admin/website/services/${serviceId}`)
  return <PageBuilder id={id} />
}

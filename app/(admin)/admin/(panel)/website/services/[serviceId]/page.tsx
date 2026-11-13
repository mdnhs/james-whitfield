import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import * as z from "zod"

import { ServiceEditorSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { ServiceEditor } from "@/admin/modules/website/service-editor"
import { hasPermission } from "@/lib/auth/permissions"
import { requirePermission } from "@/server/auth/session"
import { servicePageFor } from "@/server/modules/service-pages/service"

export const metadata: Metadata = { title: "Edit service" }

// A placeholder so the build sees the param (rejected by the uuid check).
export function generateStaticParams() {
  return [{ serviceId: "__shell" }]
}

export default function EditService({
  params,
}: PageProps<"/admin/website/services/[serviceId]">) {
  return (
    <Suspense fallback={<ServiceEditorSkeleton />}>
      <Gate params={params} />
    </Suspense>
  )
}

// One editor for a service: its card (title, slug, text, icon), its details
// page's sections, and that page's SEO.
async function Gate({
  params,
}: {
  params: PageProps<"/admin/website/services/[serviceId]">["params"]
}) {
  // Read first, as in pages/[id]: the segment cache keys on params read.
  const { serviceId } = await params
  const actor = await requirePermission({ page: ["read"] })
  if (!z.uuid().safeParse(serviceId).success) notFound()
  const page = await servicePageFor(actor, serviceId, {
    make: hasPermission(actor.roles, { collection: ["create"] }),
  })
  return (
    <ServiceEditor
      serviceId={serviceId}
      pageId={page.pageId}
      reason={"reason" in page ? page.reason : null}
    />
  )
}

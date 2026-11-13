import type { Metadata } from "next"
import { Suspense } from "react"

import { NewsletterPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { NewsletterView } from "@/admin/modules/newsletter/newsletter-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Newsletter" }

export default function NewsletterPage() {
  return (
    <Suspense fallback={<NewsletterPageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/newsletter"))
  return <NewsletterView />
}

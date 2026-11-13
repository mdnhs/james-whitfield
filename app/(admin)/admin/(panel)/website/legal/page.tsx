import type { Metadata } from "next"
import { ScaleIcon } from "lucide-react"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { LegalPagesList } from "@/admin/modules/website/legal-pages-list"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"
import { listOtherPages } from "@/server/modules/pages/service"

export const metadata: Metadata = { title: "Legal pages" }

export default function LegalPages() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/website/legal"))
  // Every custom page that is not a service's own page.
  const legal = await listOtherPages()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Legal pages"
        icon={<ScaleIcon />}
        description="Linked from the footer."
      />
      <LegalPagesList
        pages={legal.map(({ id, title, path, status, version }) => ({
          id,
          title,
          path,
          status,
          version,
        }))}
      />
    </div>
  )
}

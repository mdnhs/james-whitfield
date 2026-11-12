import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"
import { listPages } from "@/server/modules/pages/service"

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
  const { items } = await listPages()
  // Custom pages that are not a service's own page.
  const legal = items.filter(
    (page) => page.systemKey === null && !page.path.startsWith("/services/")
  )
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Legal pages"
        description="Privacy, terms and the other pages linked from the footer."
      />
      {legal.length === 0 ? (
        <p className="text-sm text-muted-foreground">No legal pages yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {legal.map((page) => (
            <li
              key={page.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex flex-col">
                <Link
                  href={`/admin/pages/${page.id}`}
                  className="font-semibold underline-offset-4 hover:text-primary hover:underline"
                >
                  {page.title}
                </Link>
                <code className="font-mono text-xs text-muted-foreground">
                  {page.path}
                </code>
              </div>
              <StatusPill
                tone={page.status === "published" ? "success" : "neutral"}
              >
                {page.status === "published" ? "Published" : "Draft"}
              </StatusPill>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

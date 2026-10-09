import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import * as z from "zod"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { PageBuilder } from "@/admin/modules/pages/page-builder"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Edit page" }

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
  await requirePermission(permissionFor("/admin/pages"))
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <PageBuilder id={id} />
}

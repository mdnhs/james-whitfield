import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import * as z from "zod"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { PageBuilder } from "@/admin/modules/pages/page-builder"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

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
  await requirePermission(permissionFor("/admin/pages"))
  if (!z.uuid().safeParse(id).success) notFound()
  return <PageBuilder id={id} />
}

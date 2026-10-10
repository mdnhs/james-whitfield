import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import * as z from "zod"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { ArticleEditorView } from "@/admin/modules/insights/article-editor-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Edit article" }

// A placeholder so the build sees the param (rejected by the uuid check).
export function generateStaticParams() {
  return [{ id: "__shell" }]
}

export default function EditArticlePage({
  params,
}: PageProps<"/admin/insights/[id]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate params={params} />
    </Suspense>
  )
}

async function Gate({
  params,
}: {
  params: PageProps<"/admin/insights/[id]">["params"]
}) {
  // Read first: Next keys the client segment cache by the params the server
  // saw read, and the auth check below is a dynamic boundary that would end
  // the render before `id` was recorded (the segment then matched any id).
  const { id } = await params
  await requirePermission(permissionFor("/admin/insights"))
  if (!z.uuid().safeParse(id).success) notFound()
  return <ArticleEditorView id={id} />
}

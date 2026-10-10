import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import * as z from "zod"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { ArticleEditorView } from "@/admin/modules/insights/article-editor-view"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Edit article" }

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
  await requirePermission(permissionFor("/admin/insights"))
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  return <ArticleEditorView id={id} />
}

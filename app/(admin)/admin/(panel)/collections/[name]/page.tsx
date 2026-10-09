import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { CollectionView } from "@/admin/modules/collections/collection-view"
import { permissionFor } from "@/lib/admin/nav"
import {
  COLLECTION_NAMES,
  type CollectionSlug,
} from "@/lib/content/collections"
import { requireActor, requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Collections" }

export default function CollectionPage({
  params,
}: PageProps<"/admin/collections/[name]">) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate params={params} />
    </Suspense>
  )
}

// Signed in before the 404, so a stranger never learns which paths exist;
// permissionFor throws for unregistered paths, so the name is checked first.
async function Gate({
  params,
}: {
  params: PageProps<"/admin/collections/[name]">["params"]
}) {
  const { name } = await params
  const path = `/admin/collections/${name}`
  await requireActor(path)
  if (!(COLLECTION_NAMES as readonly string[]).includes(name)) notFound()
  await requirePermission(permissionFor(path), path)
  return <CollectionView name={name as CollectionSlug} />
}

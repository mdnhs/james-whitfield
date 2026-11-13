import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { websiteHref, COLLECTION_HOME } from "@/lib/admin/website"
import { requireActor, requirePermission } from "@/server/auth/session"

export default function CollectionPage({
  params,
}: PageProps<"/admin/collections/[name]">) {
  return (
    <Suspense>
      <Go params={params} />
    </Suspense>
  )
}

// Collections are edited on the screen of the page that shows them. Signed in
// before the 404, so a stranger never learns which paths exist.
async function Go({
  params,
}: {
  params: PageProps<"/admin/collections/[name]">["params"]
}): Promise<never> {
  const { name } = await params
  const path = `/admin/collections/${name}`
  await requireActor(path)
  if (!Object.hasOwn(COLLECTION_HOME, name)) notFound()
  await requirePermission({ collection: ["read"] }, path)
  redirect(websiteHref(COLLECTION_HOME[name as keyof typeof COLLECTION_HOME]))
}

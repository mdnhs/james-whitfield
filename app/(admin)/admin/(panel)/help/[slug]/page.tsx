import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { HelpArticleSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { HelpArticleView } from "@/admin/modules/help/help-view"
import {
  canReadArticle,
  HELP_ARTICLES,
  helpArticle,
  helpHref,
} from "@/lib/admin/help/registry"
import { permissionFor } from "@/lib/admin/nav"
import { requireActor, requirePermission } from "@/server/auth/session"

// The docs are static data in the repo, so every article is known up front.
export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({
  params,
}: PageProps<"/admin/help/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const article = helpArticle(slug)
  return { title: article ? `${article.title} · Help` : "Help" }
}

export default function HelpArticlePage({
  params,
}: PageProps<"/admin/help/[slug]">) {
  return (
    <Suspense fallback={<HelpArticleSkeleton />}>
      <Gate params={params} />
    </Suspense>
  )
}

async function Gate({
  params,
}: {
  params: PageProps<"/admin/help/[slug]">["params"]
}) {
  const { slug } = await params
  // Signed in before the 404, so a stranger never learns which paths exist.
  await requireActor(helpHref(slug))
  const article = helpArticle(slug)
  if (!article) notFound()
  const actor = await requirePermission(
    permissionFor("/admin/help"),
    helpHref(slug)
  )
  // An article about screens the viewer's role cannot open is not listed,
  // and not served either.
  if (!canReadArticle(actor.roles, article)) notFound()
  return <HelpArticleView article={article} roles={actor.roles} />
}

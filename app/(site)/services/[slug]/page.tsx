import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"

import { CustomPagePath, PAGE_SHELL_SEGMENT } from "@/lib/content/page-path"

import { CmsPage, cmsMetadata } from "../../_cms/cms-page"

// Editor-created service landing pages (/services/<slug>). Same shape as
// app/(site)/[page]: a sentinel param gives Cache Components a build shell
// without the database, and CustomPagePath can never produce it.
export function generateStaticParams() {
  return [{ slug: PAGE_SHELL_SEGMENT }]
}

async function pathOf(params: PageProps<"/services/[slug]">["params"]) {
  const path = `/services/${(await params).slug}`
  return CustomPagePath.safeParse(path).success ? path : null
}

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  await io()
  const path = await pathOf(params)
  if (!path) notFound()
  return cmsMetadata(path)
}

export default async function ServicePage({
  params,
}: PageProps<"/services/[slug]">) {
  await io()
  const path = await pathOf(params)
  if (!path) notFound()
  return <CmsPage path={path} />
}

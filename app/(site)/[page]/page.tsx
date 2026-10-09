import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"

import { CustomPagePath, PAGE_SHELL_SEGMENT } from "@/lib/content/page-path"

import { CmsPage, cmsMetadata } from "../_cms/cms-page"

// Editor-created pages (POST /admin/pages) live one segment deep; named
// routes (about, privacy, …) win over this one. As on the article route, a
// sentinel param gives Cache Components a build shell without the database,
// and CustomPagePath can never produce it. An unknown segment renders the
// soft 404 (200 + noindex) inside the streamed shell; deeper unknown URLs
// still get global-not-found's real 404.
export function generateStaticParams() {
  return [{ page: PAGE_SHELL_SEGMENT }]
}

async function pathOf(params: PageProps<"/[page]">["params"]) {
  const path = `/${(await params).page}`
  return CustomPagePath.safeParse(path).success ? path : null
}

export async function generateMetadata({
  params,
}: PageProps<"/[page]">): Promise<Metadata> {
  await io()
  const path = await pathOf(params)
  if (!path) notFound()
  return cmsMetadata(path)
}

export default async function CustomPage({ params }: PageProps<"/[page]">) {
  await io()
  const path = await pathOf(params)
  if (!path) notFound()
  return <CmsPage path={path} />
}

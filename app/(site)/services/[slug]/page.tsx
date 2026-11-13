import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"

import { ServicePlaceholder } from "@/features/services/components/service-placeholder"
import { CustomPagePath, PAGE_SHELL_SEGMENT } from "@/lib/content/page-path"
import { isPreviewing } from "@/server/modules/content/preview"
import {
  getPublishedPage,
  getServices,
  getSetting,
} from "@/server/modules/content/queries"

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

// A visible service whose page has nothing published yet: the placeholder.
async function placeholderFor(path: string) {
  const page = await getPublishedPage(path, await isPreviewing())
  if (page) return null
  const slug = path.slice("/services/".length)
  return (await getServices()).find((s) => s.slug === slug) ?? null
}

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  await io()
  const path = await pathOf(params)
  if (!path) notFound()
  const service = await placeholderFor(path)
  if (service)
    return {
      title: service.title,
      description: service.body,
      // Thin until its page is published.
      robots: { index: false, follow: true },
    }
  return cmsMetadata(path)
}

export default async function ServicePage({
  params,
}: PageProps<"/services/[slug]">) {
  await io()
  const path = await pathOf(params)
  if (!path) notFound()
  const service = await placeholderFor(path)
  if (service) {
    const copy = await getSetting("microcopy")
    return (
      <ServicePlaceholder
        slug={service.slug}
        title={service.title}
        body={service.body}
        message={copy.serviceComingSoon}
        cta={copy.serviceComingSoonCta}
      />
    )
  }
  return <CmsPage path={path} />
}

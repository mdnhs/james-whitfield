import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { TitledSection } from "@/admin/components/titled-section"
import { HELP_LINK, linkForPath, NAV } from "@/lib/admin/nav"
import { requireActor, requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Coming soon" }

type Params = { section: string; rest?: string[] }

// Every sidebar destination that a later phase has not built yet lands here.
// A real route folder (e.g. pages/page.tsx) takes precedence over this
// dynamic one as soon as it exists.
// One prerendered route per registered path. Without it the client router
// treats every [section] value as the same page and shows whichever
// placeholder it fetched first (a click on Enquiries opened Media).
export function generateStaticParams(): Params[] {
  const hrefs = [
    HELP_LINK.href,
    ...NAV.flatMap((item) => [
      item.href,
      ...(item.children ?? []).map((child) => child.href),
    ]),
  ]
  return [...new Set(hrefs)]
    .filter((href) => href !== "/admin")
    .map((href) => {
      const [section, ...rest] = href.replace("/admin/", "").split("/")
      return { section: section!, rest }
    })
}

export default function SectionPage({ params }: { params: Promise<Params> }) {
  return (
    <Suspense fallback={<div className="rounded-card h-48 animate-pulse" />}>
      <Section params={params} />
    </Suspense>
  )
}

async function Section({ params }: { params: Promise<Params> }) {
  const { section, rest = [] } = await params
  const path = ["/admin", section, ...rest].join("/")
  // Signed in first, so a 404 never tells a stranger which paths exist.
  await requireActor(path)
  const link = linkForPath(path)
  if (!link) notFound()
  await requirePermission(link.permission, path)
  return (
    <TitledSection
      title={link.label}
      className="flex flex-col items-start gap-4"
      titleClassName="text-title"
    >
      <p className="max-w-prose text-sm text-muted-foreground">
        This part of the admin arrives in a later release. Everything you can
        see in the menu is already set up for your role.
      </p>
      <Link
        href="/admin"
        className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        Back to the dashboard
      </Link>
    </TitledSection>
  )
}

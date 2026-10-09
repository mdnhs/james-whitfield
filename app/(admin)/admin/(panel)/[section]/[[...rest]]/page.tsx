import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense, useId } from "react"

import { linkForPath, permissionFor } from "@/lib/admin/nav"
import { requireActor, requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Coming soon" }

type Params = { section: string; rest?: string[] }

// Every sidebar destination that a later phase has not built yet lands here.
// A real route folder (e.g. pages/page.tsx) takes precedence over this
// dynamic one as soon as it exists.
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
  // The same lookup a built page uses, so a stub and its replacement gate
  // identically.
  await requirePermission(permissionFor(path), path)
  return <ComingSoon label={link.label} />
}

function ComingSoon({ label }: { label: string }) {
  // Hidden routes stay in the DOM under <Activity>, so a fixed id could
  // repeat and point aria-labelledby at the wrong heading.
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col items-start gap-4"
    >
      <h1 id={titleId} className="text-title">
        {label}
      </h1>
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
    </section>
  )
}

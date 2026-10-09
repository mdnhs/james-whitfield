import type { Metadata } from "next"
import Link from "next/link"
import { Suspense, useId } from "react"

import { linkForPath } from "@/lib/admin/nav"
import { safeNext } from "@/lib/auth/safe-next"
import { requireActor } from "@/server/auth/session"

export const metadata: Metadata = { title: "No access" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Where requirePermission sends a role that may not open a page
// (docs/brief.md §7.3).
export default function NoAccessPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  return (
    <Suspense fallback={null}>
      <NoAccess searchParams={searchParams} />
    </Suspense>
  )
}

async function NoAccess({ searchParams }: { searchParams: SearchParams }) {
  await requireActor()
  const { from } = await searchParams
  const target = safeNext(typeof from === "string" ? from : null)
  const link = linkForPath(target.split(/[?#]/)[0])
  return <NoAccessNotice label={link?.label} />
}

function NoAccessNotice({ label }: { label?: string }) {
  // useId, not a fixed id: hidden routes stay in the DOM under <Activity>.
  const titleId = useId()
  return (
    <section
      aria-labelledby={titleId}
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
    >
      <h1 id={titleId} className="text-card-title">
        You don&apos;t have access to {label ?? "this page"}
      </h1>
      <p className="text-sm text-muted-foreground">
        Your role doesn&apos;t include it. Ask an owner or admin if you need it.
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

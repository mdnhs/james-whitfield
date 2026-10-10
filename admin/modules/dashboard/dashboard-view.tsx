"use client"

import { useQuery } from "@tanstack/react-query"
import { UserPlusIcon } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  LINK_PRIMARY,
  LINK_SECONDARY,
  PageHeader,
  PRIMARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { usePermission } from "@/admin/lib/actor-context"
import { Button } from "@/components/ui/button"

import { DashboardSkeleton } from "./dashboard-skeleton"
import { dashboardGreeting } from "./present"
import { dashboardQuery, type Dashboard } from "./queries"

// Fetched in the browser (not prefetched) so the shell paints at once and
// the visual suite can pin the numbers with page.route.
export function DashboardView({
  name,
  renderedAt,
  siteUrl,
}: {
  name: string
  renderedAt: string
  siteUrl: string
}) {
  const { data, isPending, isError, refetch } = useQuery(dashboardQuery())
  const greeting = dashboardGreeting(name, data?.generatedAt, renderedAt)
  const canInvite = usePermission({ user: ["create"] })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={greeting}
        titleTestId="greeting"
        description="Here's what's happening across your admin."
        actions={
          <>
            {canInvite ? (
              <Link
                href="/admin/users"
                data-slot="button"
                className={LINK_PRIMARY}
              >
                <UserPlusIcon data-icon="inline-start" />
                Invite teammate
              </Link>
            ) : null}
            <a
              href={siteUrl}
              target="_blank"
              rel="noreferrer"
              data-slot="button"
              className={LINK_SECONDARY}
            >
              View site
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </>
        }
      />
      {isPending ? (
        <DashboardSkeleton />
      ) : isError ? (
        <EmptyState
          title="The dashboard didn't load"
          description="Check your connection, then try again."
          action={
            <Button className={PRIMARY_ACTION} onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <DashboardBody data={data} />
      )}
    </div>
  )
}

function DashboardBody({ data }: { data: Dashboard }) {
  return (
    <p className="text-sm text-muted-foreground">Updated {data.generatedAt}</p>
  )
}

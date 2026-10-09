"use client"

import { useQuery } from "@tanstack/react-query"
import { CircleCheckIcon, CircleIcon, UserPlusIcon } from "lucide-react"
import Link from "next/link"

import { ActivityFeed } from "@/admin/components/dashboard/activity-feed"
import { DashboardCard } from "@/admin/components/dashboard/dashboard-card"
import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  formatDelta,
  formatNumber,
  formatShare,
} from "@/admin/components/dashboard/format"
import { Gauge } from "@/admin/components/dashboard/gauge"
import { KpiCard } from "@/admin/components/dashboard/kpi-card"
import {
  PageHeader,
  PRIMARY_ACTION,
  SECONDARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { PillBarChart } from "@/admin/components/dashboard/pill-bar-chart"
import { usePermission } from "@/admin/lib/actor-context"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { DashboardSkeleton } from "./dashboard-skeleton"
import { actionStatus } from "./present"
import { dashboardQuery, type Dashboard } from "./queries"

// Navigation styled as buttons stays a real link (role "link"), unlike
// Base UI's Button rendered as an anchor (nativeButton={false}), which
// announces as a button. The admin's one pattern for button-looking links.
// cn() so the action classes win over the variant's (border-primary over
// the outline's border-border), as Button itself merges them.
const LINK_PRIMARY = cn(buttonVariants(), PRIMARY_ACTION)
const LINK_SECONDARY = cn(
  buttonVariants({ variant: "outline" }),
  SECONDARY_ACTION
)

// With a baseline the caption compares ("+20% vs last week"); without one
// it says what the number is, rather than "vs last week" beside nothing.
function compare(
  current: number,
  previous: number,
  versus: string,
  alone: string
) {
  const delta = formatDelta(current, previous)
  return { delta, caption: delta ? versus : alone }
}

// Fetched in the browser (not prefetched) so the shell paints at once and
// the visual suite can pin the numbers with page.route.
export function DashboardView({
  greeting,
  siteUrl,
}: {
  greeting: string
  siteUrl: string
}) {
  const { data, isPending, isError, refetch } = useQuery(dashboardQuery())
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
  // Relative times are measured from the server's clock, so they read the
  // same however long the tab has been open.
  const now = Date.parse(data.generatedAt)
  const kpis = [
    {
      label: "Active users",
      value: formatNumber(data.activeUsers.value),
      ...compare(
        data.activeUsers.value,
        data.activeUsers.previous,
        "vs the 30 days before",
        "signed in, last 30 days"
      ),
      variant: "hero" as const,
    },
    {
      label: "Sign-ins this week",
      value: formatNumber(data.signIns.current),
      ...compare(
        data.signIns.current,
        data.signIns.previous,
        "vs last week",
        "none last week"
      ),
    },
    data.security
      ? {
          label: "Security health",
          value: formatShare(data.security.protected, data.security.total),
          delta: null,
          caption: `${data.security.requiredMissing + data.security.optionalMissing} without two-factor`,
          href: "/admin/users",
        }
      : null,
    data.changes
      ? {
          label: "Changes this week",
          value: formatNumber(data.changes.value),
          ...compare(
            data.changes.value,
            data.changes.previous,
            "vs last week",
            "none last week"
          ),
          href: "/admin/activity",
        }
      : null,
  ].filter((kpi) => kpi !== null)

  const next = data.nextUp.find((item) => !item.done)
  const quiet = data.signIns.current === 0 && data.signIns.previous === 0

  return (
    <>
      {/* The KPI cards title themselves with h3s; this keeps the outline
          from jumping from the page's h1 straight to them. */}
      <h2 className="sr-only">Key figures</h2>
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          kpis.length > 2 && "xl:grid-cols-4"
        )}
      >
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <DashboardCard title="Sign-ins this week">
          <div className="relative">
            <PillBarChart
              title="Sign-ins this week"
              data={data.signIns.days}
              currentLabel="This week"
              previousLabel="Last week"
            />
            {quiet ? (
              // Over the empty plot, so a quiet fortnight reads as such
              // rather than as a chart that failed to draw.
              <div className="pointer-events-none absolute inset-x-0 top-0 flex h-64 flex-col items-center justify-center gap-1 text-center">
                <p className="text-base font-semibold">No sign-ins yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Each day&apos;s sign-ins this week and last will show here.
                </p>
              </div>
            ) : null}
          </div>
        </DashboardCard>
        <DashboardCard title="Next up">
          <div className="flex flex-1 flex-col justify-between gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-2xl leading-tight font-semibold text-primary">
                {next ? next.title : "You're all set"}
              </p>
              <p className="text-sm text-muted-foreground">
                {next
                  ? next.description
                  : "Every setup step is done. New suggestions will appear here as the site grows."}
              </p>
            </div>
            {/* One step is already the headline; a list of one repeats it. */}
            {data.nextUp.length > 1 ? (
              <ul aria-label="Setup checklist" className="flex flex-col gap-2">
                {data.nextUp.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-sm">
                    {item.done ? (
                      <CircleCheckIcon
                        aria-hidden
                        className="text-success size-4"
                      />
                    ) : (
                      <CircleIcon
                        aria-hidden
                        className="size-4 text-muted-foreground"
                      />
                    )}
                    <span className={cn(item.done && "text-muted-foreground")}>
                      {item.title}
                    </span>
                    <span className="sr-only">
                      {item.done ? "(done)" : "(to do)"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {next ? (
              <Link
                href={next.href}
                data-slot="button"
                className={LINK_PRIMARY}
              >
                {next.cta}
              </Link>
            ) : null}
          </div>
        </DashboardCard>
      </div>
      {data.recentActivity || data.security ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          {data.recentActivity ? (
            <DashboardCard title="Team activity">
              <ActivityFeed
                now={now}
                emptyTitle="No activity yet"
                emptyDescription="Sign-ins, invites and changes by your team will show here."
                entries={data.recentActivity.map((row) => ({
                  id: row.id,
                  name: row.actorName ?? row.actorEmail ?? "System",
                  description: row.summary,
                  at: row.createdAt,
                  status: actionStatus(row.action),
                }))}
              />
            </DashboardCard>
          ) : null}
          {data.security ? (
            <DashboardCard title="Security health">
              <Gauge
                title="Security health"
                centerLabel="Protected"
                headlineKey="protected"
                parts={[
                  {
                    key: "protected",
                    label: "Two-factor on",
                    value: data.security.protected,
                    tone: "solid",
                  },
                  {
                    key: "required",
                    label: "Required, not set up",
                    value: data.security.requiredMissing,
                    tone: "dark",
                  },
                  {
                    key: "optional",
                    label: "Optional, not set up",
                    value: data.security.optionalMissing,
                    tone: "hatched",
                  },
                ]}
              />
            </DashboardCard>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

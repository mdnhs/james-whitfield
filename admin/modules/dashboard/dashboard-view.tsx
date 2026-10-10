"use client"

import { useQuery } from "@tanstack/react-query"
import { CircleCheckIcon, CircleIcon, PlusIcon } from "lucide-react"
import Link from "next/link"

import { ActivityFeed } from "@/admin/components/dashboard/activity-feed"
import { DashboardCard } from "@/admin/components/dashboard/dashboard-card"
import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { formatNumber } from "@/admin/components/dashboard/format"
import { Gauge } from "@/admin/components/dashboard/gauge"
import { KpiCard } from "@/admin/components/dashboard/kpi-card"
import {
  LINK_PRIMARY,
  LINK_SECONDARY,
  PageHeader,
  PRIMARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { PillBarChart } from "@/admin/components/dashboard/pill-bar-chart"
import { useActor, usePermission } from "@/admin/lib/actor-context"
import { Button } from "@/components/ui/button"
import { hasPermission, type Permissions } from "@/lib/auth/permissions"
import { cn } from "@/lib/utils"

import { DashboardSkeleton } from "./dashboard-skeleton"
import { actionStatus, dashboardGreeting, kpisFor, setupSteps } from "./present"
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
  const canWrite = usePermission({ article: ["create"] })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={greeting}
        titleTestId="greeting"
        description="Here's what's happening across your admin."
        actions={
          <>
            {canWrite ? (
              <Link
                href="/admin/insights?new=1"
                data-slot="button"
                className={LINK_PRIMARY}
              >
                <PlusIcon data-icon="inline-start" />
                New article
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
  const actor = useActor()
  const can = (p: Permissions) => hasPermission(actor.roles, p)
  // Relative times are measured from the server's clock, so they read the
  // same however long the tab has been open.
  const now = Date.parse(data.generatedAt)
  const kpis = kpisFor(data, can)
  const next = data.nextUp.find((item) => !item.done)
  const steps = setupSteps(data.nextUp)
  const quiet =
    data.enquiriesWeek.current === 0 && data.enquiriesWeek.previous === 0
  const health = data.contentHealth

  return (
    <>
      {/* The KPI cards title themselves with h3s; this keeps the outline
          from jumping from the page's h1 straight to them. */}
      <h2 className="sr-only">Key figures</h2>
      <div
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          kpis.length > 3 ? "xl:grid-cols-4" : "xl:grid-cols-3"
        )}
      >
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <DashboardCard title="Enquiries this week">
          <div className="relative">
            <PillBarChart
              title="Enquiries this week"
              data={data.enquiriesWeek.days}
              currentLabel="This week"
              previousLabel="Last week"
            />
            {quiet ? (
              // Over the empty plot, so a quiet fortnight reads as such
              // rather than as a chart that failed to draw.
              <div className="pointer-events-none absolute inset-x-0 top-0 flex h-64 flex-col items-center justify-center gap-1 text-center">
                <p className="text-base font-semibold">No enquiries yet</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Each day&apos;s enquiries this week and last will show here.
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
            {steps.length > 1 ? (
              <ul aria-label="Setup checklist" className="flex flex-col gap-2">
                {steps.map((item) => (
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
      {data.recentActivity || health ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          {data.recentActivity ? (
            <DashboardCard title="Team activity">
              <ActivityFeed
                now={now}
                emptyTitle="No activity yet"
                emptyDescription="Publishing, enquiries and sign-ins by your team will show here."
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
          {health ? (
            <DashboardCard title="Content health">
              <Gauge
                title="Content health"
                centerLabel="Complete"
                headlineKey="complete"
                parts={[
                  {
                    key: "complete",
                    label: "Complete",
                    value: health.complete,
                    tone: "solid",
                  },
                  {
                    key: "work",
                    label: "Needs work",
                    value: health.needsWork,
                    tone: "dark",
                  },
                  {
                    key: "missing",
                    label: "Missing SEO or alt",
                    value: health.missing,
                    tone: "hatched",
                  },
                ]}
              />
              {health.findings?.length ? (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">
                    Content to review ({formatNumber(health.findingsTotal)})
                  </h3>
                  <ul
                    aria-label="Content findings"
                    className="flex flex-col gap-2 text-sm"
                  >
                    {health.findings.map((finding) => (
                      <li
                        key={`${finding.rule}:${finding.href}:${finding.label}`}
                      >
                        <Link
                          href={finding.href}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {finding.label}
                        </Link>
                        <span className="block text-muted-foreground">
                          {finding.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </DashboardCard>
          ) : null}
        </div>
      ) : null}
    </>
  )
}

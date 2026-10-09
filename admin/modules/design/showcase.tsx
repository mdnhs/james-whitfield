"use client"

import { InboxIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useId } from "react"

import { ActivityFeed } from "@/admin/components/dashboard/activity-feed"
import { DashboardCard } from "@/admin/components/dashboard/dashboard-card"
import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { Gauge } from "@/admin/components/dashboard/gauge"
import { KpiCard } from "@/admin/components/dashboard/kpi-card"
import {
  PageHeader,
  PRIMARY_ACTION,
  SECONDARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { PillBarChart } from "@/admin/components/dashboard/pill-bar-chart"
import {
  CardSkeleton,
  KpiRowSkeleton,
} from "@/admin/components/dashboard/skeletons"
import {
  StatusPill,
  toneForStatus,
} from "@/admin/components/dashboard/status-pill"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  SAMPLE_CONTENT_HEALTH,
  SAMPLE_KPIS,
  SAMPLE_NOW,
  SAMPLE_TEAM,
  SAMPLE_WEEK,
} from "./sample-data"

const STATUSES = [
  "Published",
  "Draft",
  "Scheduled",
  "New",
  "Contacted",
  "Pending",
]

// Every Evergreen component on fixed data: for client demos, the
// side-by-side review against docs/design/admin-inspiration.png, and the
// visual tests.
export function Showcase() {
  const ids = useId()
  const dashboardId = `${ids}-dashboard`
  const statusId = `${ids}-status`
  const statesId = `${ids}-states`
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="Design system"
        description="Every Evergreen component on sample data."
        actions={
          <>
            <Button className={PRIMARY_ACTION}>
              <PlusIcon data-icon="inline-start" />
              New article
            </Button>
            <Button variant="outline" className={SECONDARY_ACTION}>
              View site
            </Button>
          </>
        }
      />

      <section aria-labelledby={dashboardId} className="flex flex-col gap-4">
        <h2 id={dashboardId} className="text-card-title">
          Dashboard sample
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SAMPLE_KPIS.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <DashboardCard title="Enquiries this week">
            <PillBarChart
              title="Enquiries this week"
              data={SAMPLE_WEEK}
              currentLabel="This week"
              previousLabel="Last week"
            />
          </DashboardCard>
          <DashboardCard title="Next up">
            <div className="flex flex-1 flex-col justify-between gap-6">
              <div className="flex flex-col gap-3">
                <p className="text-2xl leading-tight font-semibold text-primary">
                  Call back Aoife Byrne
                </p>
                <p className="text-sm text-muted-foreground">
                  Asked about online sessions · today, 14:00
                </p>
              </div>
              <Link
                href="/admin/leads"
                data-slot="button"
                className={cn(buttonVariants(), PRIMARY_ACTION)}
              >
                <InboxIcon data-icon="inline-start" />
                Open enquiry
              </Link>
            </div>
          </DashboardCard>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <DashboardCard title="Team activity">
            <ActivityFeed
              entries={SAMPLE_TEAM}
              now={SAMPLE_NOW}
              emptyTitle="No activity yet"
              emptyDescription="Changes by your team will show here."
            />
          </DashboardCard>
          <DashboardCard title="Content health">
            <Gauge
              title="Content health"
              parts={SAMPLE_CONTENT_HEALTH}
              centerLabel="Complete"
              headlineKey="complete"
            />
          </DashboardCard>
        </div>
      </section>

      <section aria-labelledby={statusId} className="flex flex-col gap-4">
        <h2 id={statusId} className="text-card-title">
          Status pills
        </h2>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <StatusPill key={status} tone={toneForStatus(status)}>
              {status}
            </StatusPill>
          ))}
        </div>
      </section>

      <section aria-labelledby={statesId} className="flex flex-col gap-4">
        <h2 id={statesId} className="text-card-title">
          Empty and loading states
        </h2>
        <EmptyState
          icon={InboxIcon}
          title="No enquiries yet"
          description="New messages from the contact form will appear here."
          action={
            <Button variant="outline" className={SECONDARY_ACTION}>
              Open the contact page
            </Button>
          }
        />
        <KpiRowSkeleton />
        <CardSkeleton />
      </section>
    </div>
  )
}

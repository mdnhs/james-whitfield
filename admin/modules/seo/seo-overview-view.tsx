"use client"

import { useQuery } from "@tanstack/react-query"
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  CircleCheckIcon,
  ImageIcon,
  WrenchIcon,
} from "lucide-react"
import Link from "next/link"

import { DashboardCard } from "@/admin/components/dashboard/dashboard-card"
import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { Gauge } from "@/admin/components/dashboard/gauge"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { subnavIcon } from "@/admin/components/shell/nav-icons"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { seoOverviewQuery, type SeoOverview } from "./queries"
import { FormCardSkeleton } from "@/admin/components/dashboard/skeletons"

type Issue = SeoOverview["issues"][number]

// One group per entity so a page's problems read together.
function group(issues: Issue[]) {
  const map = new Map<string, { head: Issue; items: Issue[] }>()
  for (const issue of issues) {
    const key = `${issue.kind}:${issue.id}`
    const entry = map.get(key)
    if (entry) entry.items.push(issue)
    else map.set(key, { head: issue, items: [issue] })
  }
  return [...map.values()]
}

export function SeoOverviewView() {
  const overview = useQuery(seoOverviewQuery())
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="SEO"
        icon={subnavIcon("seo-overview")}
        description="How search engines see the site."
      />
      {overview.isPending ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <FormCardSkeleton fields={2} />
          <FormCardSkeleton fields={2} />
        </div>
      ) : overview.isError ? (
        <EmptyState
          title="SEO health didn't load"
          description={overview.error.message}
          action={<Button onClick={() => overview.refetch()}>Try again</Button>}
        />
      ) : (
        <Loaded data={overview.data} />
      )}
    </div>
  )
}

function Loaded({ data }: { data: SeoOverview }) {
  const groups = group(data.issues)
  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard title="SEO health">
          <Gauge
            title="SEO health"
            centerLabel="Healthy"
            headlineKey="passed"
            parts={[
              {
                key: "passed",
                label: "Passing checks",
                value: data.passed,
                tone: "solid",
              },
              {
                key: "failed",
                label: "Needs work",
                value: data.total - data.passed,
                tone: "hatched",
              },
            ]}
          />
        </DashboardCard>
        <DashboardCard title="Alt text">
          <div className="flex flex-col items-start gap-3">
            <p className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
              {data.alt.described === data.alt.images ? (
                <CircleCheckIcon aria-hidden className="text-success size-6" />
              ) : (
                <CircleAlertIcon aria-hidden className="text-warning size-6" />
              )}
              {data.alt.described} of {data.alt.images} images described
            </p>
            <p className="text-sm text-muted-foreground">
              {data.alt.decorative} decorative
            </p>
            <Link
              href="/admin/media?missingAlt=true"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              <ImageIcon aria-hidden className="size-4" />
              Find images without alt text
            </Link>
          </div>
        </DashboardCard>
      </div>
      <DashboardCard title="Issues">
        {groups.length === 0 ? (
          <EmptyState
            icon={CheckCircle2Icon}
            title="No issues"
            description="Every live page passes the checks."
          />
        ) : (
          <ul role="list" aria-label="Issues" className="flex flex-col gap-5">
            {groups.map(({ head, items }) => (
              <li
                key={`${head.kind}:${head.id}`}
                className="flex flex-col gap-2 border-b pb-4 last:border-b-0 last:pb-0"
              >
                <p className="font-semibold">
                  {head.title}
                  {head.path ? (
                    <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                      {head.path}
                    </span>
                  ) : null}
                </p>
                <ul role="list" className="flex flex-col gap-2">
                  {items.map((issue) => (
                    <li
                      key={issue.check}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex items-start gap-2">
                        <CircleAlertIcon
                          aria-hidden
                          className="text-warning mt-0.5 size-4 shrink-0"
                        />
                        <span>
                          <span className="sr-only">Needs work: </span>
                          {issue.message}
                        </span>
                      </span>
                      <Link
                        href={issue.fixHref}
                        aria-label={`Fix: ${issue.message} (${head.title})`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "shrink-0"
                        )}
                      >
                        <WrenchIcon aria-hidden data-icon="inline-start" />
                        Fix
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </DashboardCard>
    </>
  )
}

"use client"

import { useQuery } from "@tanstack/react-query"
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { formatDistanceToNow } from "date-fns"
import { FileTextIcon } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { DataTable } from "@/admin/components/data-table/data-table"
import { Button } from "@/components/ui/button"
import { adminHrefForPage } from "@/lib/admin/website"

import { pagesListQuery, type PageSummary } from "./queries"

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, PageSummary>()
const EMPTY: PageSummary[] = []

function PageStatus({ page }: { page: PageSummary }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      <StatusPill tone={page.status === "published" ? "success" : "neutral"}>
        {page.status === "published" ? "Published" : "Draft"}
      </StatusPill>
      {page.hasUnpublishedChanges && page.status === "published" ? (
        <StatusPill tone="warning">Unpublished changes</StatusPill>
      ) : null}
      {page.needsReview ? (
        <StatusPill tone="danger">Needs review</StatusPill>
      ) : null}
    </span>
  )
}

const updated = (page: PageSummary) =>
  formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })

const columns = helper.columns([
  helper.accessor("title", {
    header: "Title",
    cell: (info) => (
      <Link
        href={adminHrefForPage(info.row.original)}
        className="font-semibold underline-offset-4 hover:text-primary hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  helper.accessor("path", {
    header: "Address",
    cell: (info) => (
      <code className="font-mono text-xs text-muted-foreground">
        {info.getValue()}
      </code>
    ),
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: (info) => <PageStatus page={info.row.original} />,
  }),
  helper.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => (
      <time
        dateTime={info.getValue()}
        className="whitespace-nowrap text-muted-foreground"
      >
        {updated(info.row.original)}
      </time>
    ),
  }),
])

export function PagesView() {
  const list = useQuery(pagesListQuery())
  const table = useTable({
    features,
    columns,
    data: list.data?.items ?? EMPTY,
    getRowId: (row) => row.id,
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pages"
        description="Every page of the site. Changes stay in a draft until you publish."
      />
      {list.isPending ? (
        <CardSkeleton />
      ) : list.isError ? (
        <EmptyState
          title="The pages didn't load"
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : (
        <DataTable
          table={table}
          caption="Pages"
          empty={
            <EmptyState
              icon={FileTextIcon}
              title="No pages yet"
              description="Pages you create appear here, with their status."
            />
          }
          renderCard={(row) => (
            <div className="flex flex-col gap-2 text-sm">
              <Link
                href={adminHrefForPage(row.original)}
                className="font-semibold"
              >
                {row.original.title}
              </Link>
              <code className="font-mono text-xs text-muted-foreground">
                {row.original.path}
              </code>
              <PageStatus page={row.original} />
              <p className="text-xs text-muted-foreground">
                Updated {updated(row.original)}
              </p>
            </div>
          )}
        />
      )}
    </div>
  )
}

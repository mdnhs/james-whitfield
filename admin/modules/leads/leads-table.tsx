"use client"

import {
  createColumnHelper,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { InboxIcon, ShieldCheckIcon } from "lucide-react"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { DataTable } from "@/admin/components/data-table/data-table"
import { DataTablePagination } from "@/admin/components/data-table/data-table-pagination"

import { LeadStatusPill } from "./lead-status-pill"
import { formatWhen, topicLabel } from "./present"
import type { LeadRow } from "./queries"

const features = tableFeatures({ rowPaginationFeature })
const helper = createColumnHelper<typeof features, LeadRow>()

export function LeadsTable({
  rows,
  page,
  pageSize,
  total,
  folder,
  isFetching,
  onPageChange,
  onOpen,
}: {
  rows: LeadRow[]
  page: number
  pageSize: number
  total: number
  folder: "inbox" | "spam"
  isFetching: boolean
  onPageChange(page: number): void
  onOpen(id: string): void
}) {
  const columns = helper.columns([
    helper.accessor("name", {
      header: "Name",
      cell: (info) => (
        <button
          type="button"
          onClick={(event) => {
            // The row's own click handler would open it a second time.
            event.stopPropagation()
            onOpen(info.row.original.id)
          }}
          className="text-left font-semibold outline-none focus-visible:underline"
        >
          {info.getValue()}
        </button>
      ),
    }),
    helper.accessor("email", { header: "Email" }),
    helper.accessor((row) => topicLabel(row.topicSlug), {
      id: "topic",
      header: "Topic",
    }),
    helper.accessor("status", {
      header: "Status",
      cell: (info) => <LeadStatusPill status={info.getValue()} />,
    }),
    helper.accessor((row) => row.assignee?.name ?? "Unassigned", {
      id: "assignee",
      header: "Assignee",
    }),
    helper.accessor("createdAt", {
      header: "Received",
      cell: (info) => (
        <time
          dateTime={info.getValue()}
          className="whitespace-nowrap tabular-nums"
        >
          {formatWhen(info.getValue())}
        </time>
      ),
    }),
  ])

  const table = useTable({
    features,
    columns,
    data: rows,
    getRowId: (row) => row.id,
    manualPagination: true,
    rowCount: total,
    state: { pagination: { pageIndex: page - 1, pageSize } },
  })

  return (
    <>
      <DataTable
        table={table}
        caption={folder === "spam" ? "Spam" : "Enquiries"}
        isFetching={isFetching}
        onRowClick={(row) => onOpen(row.original.id)}
        empty={
          folder === "spam" ? (
            <EmptyState
              icon={ShieldCheckIcon}
              title="No spam"
              description="Suspicious submissions land here."
            />
          ) : (
            <EmptyState
              icon={InboxIcon}
              title="No enquiries yet"
              description="Contact form messages appear here."
            />
          )
        }
        renderCard={(row) => (
          <button
            type="button"
            onClick={() => onOpen(row.original.id)}
            className="flex w-full flex-col gap-1 text-left text-sm"
          >
            <span className="font-semibold">{row.original.name}</span>
            <span className="text-muted-foreground">{row.original.email}</span>
            <span className="flex items-center gap-2">
              <LeadStatusPill status={row.original.status} />
              <span className="text-xs text-muted-foreground">
                {formatWhen(row.original.createdAt)}
              </span>
            </span>
          </button>
        )}
      />
      <DataTablePagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={onPageChange}
      />
    </>
  )
}

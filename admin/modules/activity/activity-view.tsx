"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  createColumnHelper,
  functionalUpdate,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { HistoryIcon } from "lucide-react"
import { useQueryStates } from "nuqs"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { DataTable } from "@/admin/components/data-table/data-table"
import { DataTablePagination } from "@/admin/components/data-table/data-table-pagination"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { activityParsers, toAuditParams, toDay } from "./params"
import { auditFacetsQuery, auditListQuery, type AuditRow } from "./queries"

const features = tableFeatures({ rowPaginationFeature })
const helper = createColumnHelper<typeof features, AuditRow>()
const EMPTY: AuditRow[] = []
const ALL = "__all__"

const WHEN = new Intl.DateTimeFormat("en-IE", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Dublin",
})

const who = (row: AuditRow) => row.actorName ?? row.actorEmail ?? "System"

const columns = helper.columns([
  helper.accessor("createdAt", {
    header: "When",
    cell: (info) => (
      <time
        dateTime={info.getValue()}
        className="whitespace-nowrap tabular-nums"
      >
        {WHEN.format(new Date(info.getValue()))}
      </time>
    ),
  }),
  helper.accessor((row) => who(row), { id: "actor", header: "Who" }),
  helper.accessor("action", {
    header: "Action",
    cell: (info) => (
      <code className="font-mono text-xs">{info.getValue()}</code>
    ),
  }),
  helper.accessor("summary", { header: "What" }),
])

export function ActivityView() {
  const [state, setState] = useQueryStates(activityParsers, {
    history: "replace",
  })
  const params = toAuditParams(state)
  const list = useQuery({
    ...auditListQuery(params),
    placeholderData: keepPreviousData,
  })
  const facets = useQuery(auditFacetsQuery())
  const pagination = { pageIndex: params.page - 1, pageSize: params.pageSize }

  const table = useTable({
    features,
    columns,
    data: list.data?.items ?? EMPTY,
    getRowId: (row) => row.id,
    manualPagination: true,
    rowCount: list.data?.total ?? 0,
    state: { pagination },
    onPaginationChange: (updater) => {
      const next = functionalUpdate(updater, pagination)
      void setState({ page: next.pageIndex + 1, pageSize: next.pageSize })
    },
  })

  const actionItems = [
    { value: ALL, label: "All actions" },
    ...(facets.data?.actions ?? []).map((action) => ({
      value: action,
      label: action,
    })),
  ]
  const actorItems = [
    { value: ALL, label: "Everyone" },
    ...(facets.data?.actors ?? []).map((actor) => ({
      value: actor.id,
      label: actor.label,
    })),
  ]
  // Any filter change starts again from page 1.
  const filter = (values: Partial<typeof state>) =>
    void setState({ ...values, page: 1 })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activity log"
        description="Who changed what, and when. Times are Irish time."
      />
      <div
        role="group"
        aria-label="Filters"
        className="flex flex-wrap items-end gap-3"
      >
        <Field className="w-full sm:w-56">
          <FieldLabel htmlFor="activity-action">Action</FieldLabel>
          <Select
            items={actionItems}
            value={state.action ?? ALL}
            onValueChange={(value) =>
              filter({ action: value === ALL ? null : String(value) })
            }
          >
            <SelectTrigger id="activity-action" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {actionItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-full sm:w-64">
          <FieldLabel htmlFor="activity-actor">Person</FieldLabel>
          <Select
            items={actorItems}
            value={state.actor ?? ALL}
            onValueChange={(value) =>
              filter({ actor: value === ALL ? null : String(value) })
            }
          >
            <SelectTrigger id="activity-actor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {actorItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-[calc(50%-0.375rem)] sm:w-44">
          <FieldLabel htmlFor="activity-from">From</FieldLabel>
          <Input
            id="activity-from"
            type="date"
            value={toDay(state.from) ?? ""}
            onChange={(event) =>
              filter({
                from: event.target.value ? new Date(event.target.value) : null,
              })
            }
          />
        </Field>
        <Field className="w-[calc(50%-0.375rem)] sm:w-44">
          <FieldLabel htmlFor="activity-to">To</FieldLabel>
          <Input
            id="activity-to"
            type="date"
            value={toDay(state.to) ?? ""}
            onChange={(event) =>
              filter({
                to: event.target.value ? new Date(event.target.value) : null,
              })
            }
          />
        </Field>
        <Button
          variant="ghost"
          className="h-9"
          onClick={() =>
            filter({ action: null, actor: null, from: null, to: null })
          }
        >
          Reset filters
        </Button>
      </div>
      {list.isPending ? (
        <CardSkeleton />
      ) : list.isError ? (
        <EmptyState
          title="The activity log didn't load"
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <DataTable
            table={table}
            caption="Activity log"
            isFetching={list.isFetching}
            empty={
              <EmptyState
                icon={HistoryIcon}
                title="Nothing matches these filters"
                description="Try a wider date range or reset the filters."
              />
            }
            renderCard={(row) => (
              <div className="flex flex-col gap-1 text-sm">
                <p className="font-semibold">{who(row.original)}</p>
                <p>{row.original.summary}</p>
                <p className="text-xs text-muted-foreground">
                  <code className="font-mono">{row.original.action}</code> ·{" "}
                  {WHEN.format(new Date(row.original.createdAt))}
                </p>
              </div>
            )}
          />
          <DataTablePagination
            page={params.page}
            pageSize={params.pageSize}
            total={list.data.total}
            onPageChange={(page) => table.setPageIndex(page - 1)}
          />
        </>
      )}
    </div>
  )
}

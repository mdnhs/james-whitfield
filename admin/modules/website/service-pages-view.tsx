"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { FileTextIcon, TriangleAlertIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { DataTable } from "@/admin/components/data-table/data-table"
import { usePermission } from "@/admin/lib/actor-context"
import { parseResponse, servicePagesApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { collectionListQuery } from "@/admin/modules/collections/queries"
import { formatDublin } from "@/admin/modules/insights/schedule-time"
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

type DetailPage = {
  id: string
  path: string
  status: "draft" | "published"
  updatedAt: string
}

// One row per service and its details page.
export type ServicePageRow = {
  serviceId: string
  title: string
  slug: string
  page: DetailPage | null
}

type Failure = { serviceId: string; message: string }

type StatusFilter = "all" | "published" | "draft"
const STATUS_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
]

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, ServicePageRow>()

function PageStatus({ page }: { page: DetailPage | null }) {
  if (!page) return <StatusPill tone="warning">Not created</StatusPill>
  return page.status === "published" ? (
    <StatusPill tone="success">Published</StatusPill>
  ) : (
    <StatusPill tone="neutral">Draft</StatusPill>
  )
}

function Title({ row }: { row: ServicePageRow }) {
  return row.page ? (
    <Link
      href={`/admin/pages/${row.page.id}`}
      className="font-semibold underline-offset-4 hover:text-primary hover:underline"
    >
      {row.title}
    </Link>
  ) : (
    <span className="font-semibold">{row.title}</span>
  )
}

const columns = helper.columns([
  helper.accessor("title", {
    header: "Service",
    cell: (info) => <Title row={info.row.original} />,
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: (info) => <PageStatus page={info.row.original.page} />,
  }),
  helper.display({
    id: "address",
    header: "Address",
    cell: (info) => (
      <span className="font-mono text-xs text-muted-foreground">
        {info.row.original.page?.path ?? `/services/${info.row.original.slug}`}
      </span>
    ),
  }),
  helper.display({
    id: "updated",
    header: "Updated",
    cell: (info) => {
      const page = info.row.original.page
      return page ? (
        <time
          dateTime={page.updatedAt}
          className="whitespace-nowrap text-muted-foreground"
        >
          {formatDublin(page.updatedAt)}
        </time>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    },
  }),
])

// Every service has a details page, made automatically (when the service is
// added, or here for any that are missing). Editors open one to edit its
// content; there is nothing to create or delete.
export function ServicePagesView() {
  const queryClient = useQueryClient()
  const list = useQuery(collectionListQuery("services"))
  const canCreate = usePermission({ collection: ["create"] })
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")

  const ensure = useMutation({
    mutationFn: () =>
      parseResponse(servicePagesApi.ensure.$post()) as Promise<{
        created: number
        failed: Failure[]
      }>,
    onSuccess: async (result) => {
      if (result.created > 0)
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.collections.list("services"),
          }),
          queryClient.invalidateQueries({ queryKey: queryKeys.pages.list }),
        ])
    },
  })
  const ran = useRef(false)
  useEffect(() => {
    if (!canCreate || ran.current) return
    ran.current = true
    ensure.mutate()
  }, [canCreate, ensure])

  const rows = useMemo<ServicePageRow[]>(
    () =>
      (list.data?.items ?? []).map((item) => ({
        serviceId: item.id,
        title: item.title,
        slug: String((item.values as { slug?: unknown }).slug ?? ""),
        page:
          "detailPage" in item ? (item.detailPage as DetailPage | null) : null,
      })),
    [list.data]
  )
  const q = search.trim().toLowerCase()
  const shown = rows.filter(
    (row) =>
      (!q || row.title.toLowerCase().includes(q)) &&
      (status === "all" || row.page?.status === status)
  )
  const failures = ensure.data?.failed ?? []
  const titleOf = (id: string) =>
    rows.find((row) => row.serviceId === id)?.title ?? "A service"

  const table = useTable({
    features,
    columns,
    data: shown,
    getRowId: (row) => row.serviceId,
  })
  const filtered = Boolean(q) || status !== "all"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Service pages"
        description="Each service has its own details page at /services/<slug>. Open one to edit it; changes stay in a draft until you publish."
      />
      {failures.length > 0 ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        >
          <TriangleAlertIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <ul className="flex flex-col gap-1">
            {failures.map((failure) => (
              <li key={failure.serviceId}>
                <span className="font-semibold">
                  {titleOf(failure.serviceId)}:
                </span>{" "}
                its page couldn&apos;t be made yet. {failure.message}.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <Field className="w-full sm:w-64">
          <FieldLabel htmlFor="service-pages-search">
            Search services
          </FieldLabel>
          <Input
            id="service-pages-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Field className="w-full sm:w-44">
          <FieldLabel htmlFor="service-pages-status">Status</FieldLabel>
          <Select
            items={STATUS_ITEMS}
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
          >
            <SelectTrigger id="service-pages-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {list.isPending ? (
        <CardSkeleton />
      ) : list.isError ? (
        <EmptyState
          title="The service pages didn't load"
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : (
        <DataTable
          table={table}
          caption="Service pages"
          isFetching={list.isFetching || ensure.isPending}
          empty={
            <EmptyState
              icon={FileTextIcon}
              title={filtered ? "No matching services" : "No services yet"}
              description={
                filtered
                  ? "Try a different search or clear the filter."
                  : "Add a service on the Services page and its details page appears here."
              }
            />
          }
          renderCard={(row) => (
            <div className="flex flex-col gap-2 text-sm">
              <Title row={row.original} />
              <PageStatus page={row.original.page} />
            </div>
          )}
        />
      )}
    </div>
  )
}

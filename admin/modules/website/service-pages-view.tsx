"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { FileTextIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  PageHeader,
  PRIMARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { DataTable } from "@/admin/components/data-table/data-table"
import { usePermission } from "@/admin/lib/actor-context"
import { parseResponse, servicePagesApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { collectionListQuery } from "@/admin/modules/collections/queries"
import { formatDublin } from "@/admin/modules/insights/schedule-time"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

// One row per service: its details page, if it has one.
export type ServicePageRow = {
  serviceId: string
  title: string
  slug: string
  page: DetailPage | null
}

type StatusFilter = "all" | "published" | "draft" | "none"
const STATUS_ITEMS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "none", label: "No page yet" },
]

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, ServicePageRow>()

const editHref = (row: ServicePageRow) =>
  row.page ? `/admin/pages/${row.page.id}` : null

function PageStatus({ page }: { page: DetailPage | null }) {
  if (!page) return <StatusPill tone="neutral">No page yet</StatusPill>
  return page.status === "published" ? (
    <StatusPill tone="success">Published</StatusPill>
  ) : (
    <StatusPill tone="neutral">Draft</StatusPill>
  )
}

function matches(row: ServicePageRow, q: string, status: StatusFilter) {
  if (q && !row.title.toLowerCase().includes(q.toLowerCase())) return false
  if (status === "none") return row.page === null
  if (status === "all") return true
  return row.page?.status === status
}

// Service details pages, listed like articles: open one to edit it, create
// one for a service that has none, or delete one.
export function ServicePagesView() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const list = useQuery(collectionListQuery("services"))
  const canCreate = usePermission({ collection: ["create"] })
  const canDelete = usePermission({ collection: ["delete"] })
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [busy, setBusy] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [pick, setPick] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ServicePageRow | null>(null)

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
  const shown = rows.filter((row) => matches(row, search.trim(), status))
  const withoutPage = rows.filter((row) => row.page === null)

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.collections.list("services"),
      }),
      queryClient.invalidateQueries({ queryKey: queryKeys.pages.list }),
    ])
  }

  async function create(serviceId: string) {
    if (busy) return
    setBusy(serviceId)
    try {
      const { pageId } = (await parseResponse(
        servicePagesApi[":serviceId"].$post({ param: { serviceId } })
      )) as { pageId: string }
      setCreating(false)
      await refresh()
      router.push(`/admin/pages/${pageId}`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't create the details page"
      )
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  async function confirmDelete() {
    if (!deleting || busy) return
    const { serviceId } = deleting
    setBusy(serviceId)
    try {
      await parseResponse(
        servicePagesApi[":serviceId"].$delete({ param: { serviceId } })
      )
      setDeleting(null)
      toast.success("Details page deleted")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't delete the details page"
      )
    } finally {
      await refresh()
      setBusy(null)
    }
  }

  const actions = (row: ServicePageRow) =>
    row.page ? (
      canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={busy !== null}
          onClick={() => setDeleting(row)}
        >
          Delete
        </Button>
      ) : null
    ) : canCreate ? (
      <Button
        variant="outline"
        size="sm"
        disabled={busy !== null}
        onClick={() => void create(row.serviceId)}
      >
        Create page
      </Button>
    ) : null

  const columns = helper.columns([
    helper.accessor("title", {
      header: "Service",
      cell: (info) => {
        const href = editHref(info.row.original)
        return href ? (
          <Link
            href={href}
            className="font-semibold underline-offset-4 hover:text-primary hover:underline"
          >
            {info.getValue()}
          </Link>
        ) : (
          <span className="font-semibold">{info.getValue()}</span>
        )
      },
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
          {info.row.original.page?.path ??
            `/services/${info.row.original.slug}`}
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
    helper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => (
        <div className="flex justify-end">{actions(info.row.original)}</div>
      ),
    }),
  ])

  const table = useTable({
    features,
    columns,
    data: shown,
    getRowId: (row) => row.serviceId,
  })

  const newButton =
    canCreate && withoutPage.length > 0 ? (
      <Button className={PRIMARY_ACTION} onClick={() => setCreating(true)}>
        <PlusIcon data-icon="inline-start" />
        New service page
      </Button>
    ) : null
  const filtered = Boolean(search.trim()) || status !== "all"

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Service pages"
        description="A details page for each service, at /services/<slug>. Changes stay in a draft until you publish."
        actions={newButton}
      />
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
          isFetching={list.isFetching}
          empty={
            <EmptyState
              icon={FileTextIcon}
              title={filtered ? "No matching services" : "No services yet"}
              description={
                filtered
                  ? "Try a different search or clear the filter."
                  : "Add services on the Services page; each can then have a details page here."
              }
            />
          }
          renderCard={(row) => {
            const href = editHref(row.original)
            return (
              <div className="flex flex-col gap-2 text-sm">
                {href ? (
                  <Link href={href} className="font-semibold">
                    {row.original.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{row.original.title}</span>
                )}
                <PageStatus page={row.original.page} />
                <div>{actions(row.original)}</div>
              </div>
            )
          }}
        />
      )}

      <Dialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open)
          if (!open) setPick(null)
        }}
      >
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader className="gap-3">
            <DialogTitle className="text-lg font-semibold">
              New service page
            </DialogTitle>
            <DialogDescription>
              Choose the service. Its page starts as a draft with every section
              ready to fill in.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="new-service-page">Service</FieldLabel>
            <Select
              items={withoutPage.map((row) => ({
                value: row.serviceId,
                label: row.title,
              }))}
              value={pick}
              onValueChange={(value) => setPick(String(value))}
            >
              <SelectTrigger id="new-service-page" className="w-full">
                <SelectValue placeholder="Choose a service" />
              </SelectTrigger>
              <SelectContent>
                {withoutPage.map((row) => (
                  <SelectItem key={row.serviceId} value={row.serviceId}>
                    {row.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <DialogFooter className="-mx-6 -mb-6 rounded-b-xl border-t bg-muted/50 p-4 sm:justify-end">
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              disabled={!pick || busy !== null}
              onClick={() => pick && void create(pick)}
            >
              Create page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader className="gap-3">
            <DialogTitle className="text-lg font-semibold">
              Delete details page?
            </DialogTitle>
            <DialogDescription>
              {`Delete the details page for ${deleting?.title ?? ""}? Its content can't be recovered.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 rounded-b-xl border-t bg-muted/50 p-4 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => void confirmDelete()}
            >
              Delete page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

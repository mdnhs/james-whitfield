"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  createColumnHelper,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { ArrowRightLeftIcon, PlusIcon } from "lucide-react"
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  PageHeader,
  PRIMARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { DataTable } from "@/admin/components/data-table/data-table"
import { DataTablePagination } from "@/admin/components/data-table/data-table-pagination"
import { usePermission } from "@/admin/lib/actor-context"
import { parseResponse, seoApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"
import { formatWhen } from "@/admin/modules/leads/present"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { RedirectDialog, STATUS_LABELS, type Editing } from "./redirect-dialog"
import { redirectsListQuery, type RedirectRow } from "./queries"

const PAGE_SIZE = 25
const params = {
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
}

const features = tableFeatures({ rowPaginationFeature })
const helper = createColumnHelper<typeof features, RedirectRow>()

function RedirectStatus({ row }: { row: RedirectRow }) {
  if (!row.isActive) return <StatusPill tone="neutral">Off</StatusPill>
  if (row.shadowed)
    return (
      <StatusPill tone="warning">Inactive while the page is live</StatusPill>
    )
  return <StatusPill tone="success">Active</StatusPill>
}

export function RedirectsView() {
  const [state, setState] = useQueryStates(params, { history: "replace" })
  const canManage = usePermission({ redirect: ["manage"] })
  const [editing, setEditing] = useState<Editing>(null)
  const [removing, setRemoving] = useState<RedirectRow | null>(null)
  useResetOnHide(() => {
    setEditing(null)
    setRemoving(null)
  })
  const client = useQueryClient()

  const listParams = {
    q: state.q || undefined,
    page: Math.max(1, state.page),
    pageSize: PAGE_SIZE,
  }
  const list = useQuery({
    ...redirectsListQuery(listParams),
    placeholderData: keepPreviousData,
  })

  const [search, setSearch] = useState(state.q)
  useEffect(() => {
    if (search === state.q) return
    const timer = setTimeout(() => void setState({ q: search, page: 1 }), 300)
    return () => clearTimeout(timer)
  }, [search, state.q, setState])

  const total = list.data?.total
  const lastPage =
    total === undefined ? undefined : Math.max(1, Math.ceil(total / PAGE_SIZE))
  useEffect(() => {
    if (lastPage !== undefined && state.page > lastPage)
      void setState({ page: lastPage })
  }, [lastPage, state.page, setState])

  const toggle = useMutation({
    mutationFn: (row: RedirectRow) =>
      parseResponse(
        seoApi.redirects[":id"].$patch({
          param: { id: row.id },
          json: { isActive: !row.isActive },
        })
      ),
    onSuccess: (result) => {
      toast.success(result.redirect.isActive ? "Redirect on" : "Redirect off")
      if (result.warning) toast.warning(result.warning)
      void client.invalidateQueries({ queryKey: queryKeys.seo.all })
    },
    onError: (error) => toast.error(error.message),
  })

  const actions = (row: RedirectRow) => (
    <div className="flex flex-wrap gap-1">
      <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(row)}
      >
        {row.isActive ? "Turn off" : "Turn on"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setRemoving(row)}>
        Delete
      </Button>
    </div>
  )

  const columns = helper.columns([
    helper.accessor("sourcePath", {
      header: "From",
      cell: (info) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs break-all">{info.getValue()}</span>
          {info.row.original.automatic ? (
            <Badge variant="secondary">Automatic</Badge>
          ) : null}
        </span>
      ),
    }),
    helper.accessor("destination", {
      header: "To",
      cell: (info) => (
        <span className="font-mono text-xs break-all">{info.getValue()}</span>
      ),
    }),
    helper.accessor("statusCode", {
      header: "Type",
      cell: (info) => STATUS_LABELS[info.getValue()] ?? info.getValue(),
    }),
    helper.accessor("hitCount", {
      header: "Hits",
      cell: (info) => (
        <span className="tabular-nums">
          {info.getValue().toLocaleString("en-IE")}
        </span>
      ),
    }),
    helper.accessor("lastHitAt", {
      header: "Last hit",
      cell: (info) => {
        const value = info.getValue()
        return value ? (
          <time dateTime={value} className="whitespace-nowrap tabular-nums">
            {formatWhen(value)}
          </time>
        ) : (
          "Never"
        )
      },
    }),
    helper.display({
      id: "status",
      header: "Status",
      cell: (info) => <RedirectStatus row={info.row.original} />,
    }),
    ...(canManage
      ? [
          helper.display({
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: (info) => actions(info.row.original),
          }),
        ]
      : []),
  ])

  const table = useTable({
    features,
    columns,
    data: list.data?.items ?? [],
    getRowId: (row) => row.id,
    manualPagination: true,
    rowCount: list.data?.total ?? 0,
    state: {
      pagination: { pageIndex: listParams.page - 1, pageSize: PAGE_SIZE },
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Redirects"
        description="Send old addresses to the right page. Renamed articles and moved pages add theirs automatically."
        actions={
          canManage ? (
            <Button
              className={cn(PRIMARY_ACTION)}
              onClick={() => setEditing("new")}
            >
              <PlusIcon aria-hidden />
              New redirect
            </Button>
          ) : null
        }
      />
      <Input
        type="search"
        aria-label="Search redirects"
        placeholder="Search addresses"
        className="w-full sm:w-72"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {list.isPending ? (
        <CardSkeleton />
      ) : list.isError ? (
        <EmptyState
          title="Redirects didn't load"
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <DataTable
            table={table}
            caption="Redirects"
            isFetching={list.isFetching}
            empty={
              <EmptyState
                icon={ArrowRightLeftIcon}
                title="No redirects yet"
                description="Renamed articles and moved pages add theirs automatically."
              />
            }
            renderCard={(row) => (
              <div className="flex flex-col gap-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs break-all">
                    {row.original.sourcePath}
                  </span>
                  {row.original.automatic ? (
                    <Badge variant="secondary">Automatic</Badge>
                  ) : null}
                </span>
                <span className="font-mono text-xs break-all text-muted-foreground">
                  to {row.original.destination}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <RedirectStatus row={row.original} />
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABELS[row.original.statusCode]} ·{" "}
                    {row.original.hitCount} hits
                  </span>
                </span>
                {canManage ? actions(row.original) : null}
              </div>
            )}
          />
          <DataTablePagination
            page={listParams.page}
            pageSize={PAGE_SIZE}
            total={list.data.total}
            onPageChange={(page) =>
              void setState({ page }, { history: "push" })
            }
          />
        </>
      )}
      <RedirectDialog editing={editing} onClose={() => setEditing(null)} />
      <DeleteDialog redirect={removing} onClose={() => setRemoving(null)} />
    </div>
  )
}

function DeleteDialog({
  redirect,
  onClose,
}: {
  redirect: RedirectRow | null
  onClose(): void
}) {
  const client = useQueryClient()
  const remove = useMutation({
    mutationFn: (id: string) =>
      parseResponse(seoApi.redirects[":id"].$delete({ param: { id } })),
    onSuccess: () => {
      toast.success("Redirect deleted")
      void client.invalidateQueries({ queryKey: queryKeys.seo.all })
      onClose()
    },
    onError: (error) => toast.error(error.message),
  })
  return (
    <Dialog
      open={redirect !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this redirect?</DialogTitle>
          <DialogDescription>
            {redirect?.sourcePath} will stop sending visitors to{" "}
            {redirect?.destination}. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => redirect && remove.mutate(redirect.id)}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

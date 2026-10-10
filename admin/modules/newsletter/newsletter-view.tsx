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
import { DownloadIcon, MailIcon } from "lucide-react"
import {
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  PageHeader,
  SECONDARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import {
  StatusPill,
  type StatusTone,
} from "@/admin/components/dashboard/status-pill"
import { DataTable } from "@/admin/components/data-table/data-table"
import { DataTablePagination } from "@/admin/components/data-table/data-table-pagination"
import { usePermission } from "@/admin/lib/actor-context"
import { newsletterApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { formatWhen } from "@/admin/modules/leads/present"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import {
  exportHref,
  subscribersListQuery,
  type SubscriberRow,
  type SubscribersListParams,
} from "./queries"

const PAGE_SIZE = 25
const TABS = ["confirmed", "pending", "unsubscribed", "all"] as const
const params = {
  tab: parseAsStringLiteral(TABS).withDefault("confirmed"),
  q: parseAsString.withDefault(""),
  page: parseAsInteger.withDefault(1),
}

const TONES: Record<string, StatusTone> = {
  confirmed: "success",
  pending: "warning",
  unsubscribed: "neutral",
}
const LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  pending: "Pending",
  unsubscribed: "Unsubscribed",
}

const features = tableFeatures({ rowPaginationFeature })
const helper = createColumnHelper<typeof features, SubscriberRow>()

export function NewsletterView() {
  const [state, setState] = useQueryStates(params, { history: "replace" })
  const canExport = usePermission({ newsletter: ["export"] })
  const canDelete = usePermission({ newsletter: ["delete"] })
  const [removing, setRemoving] = useState<SubscriberRow | null>(null)

  const listParams: SubscribersListParams = {
    status: state.tab === "all" ? undefined : state.tab,
    q: state.q || undefined,
    page: Math.max(1, state.page),
    pageSize: PAGE_SIZE,
  }
  const list = useQuery({
    ...subscribersListQuery(listParams),
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

  const columns = helper.columns([
    helper.accessor("email", { header: "Email" }),
    helper.accessor("status", {
      header: "Status",
      cell: (info) => (
        <StatusPill tone={TONES[info.getValue()] ?? "neutral"}>
          {LABELS[info.getValue()] ?? info.getValue()}
        </StatusPill>
      ),
    }),
    helper.accessor("sourcePath", { header: "Source" }),
    helper.accessor((row) => row.confirmedAt ?? row.createdAt, {
      id: "subscribed",
      header: "Subscribed",
      cell: (info) => (
        <time
          dateTime={info.getValue()}
          className="whitespace-nowrap tabular-nums"
        >
          {formatWhen(info.getValue())}
        </time>
      ),
    }),
    ...(canDelete
      ? [
          helper.display({
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: (info) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRemoving(info.row.original)}
              >
                Delete
              </Button>
            ),
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
        title="Newsletter"
        description="People who signed up to the monthly letter. Times are Irish time."
        actions={
          canExport ? (
            <a
              href={exportHref(state.tab === "all")}
              className={cn(
                buttonVariants({ variant: "outline" }),
                SECONDARY_ACTION
              )}
            >
              <DownloadIcon aria-hidden />
              Export CSV
            </a>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={state.tab}
          onValueChange={(value) =>
            void setState({ tab: value as (typeof TABS)[number], page: 1 })
          }
        >
          <TabsList>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="unsubscribed">Unsubscribed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          type="search"
          aria-label="Search subscribers"
          placeholder="Search email"
          className="w-full sm:ml-auto sm:w-72"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {list.isPending ? (
        <CardSkeleton />
      ) : list.isError ? (
        <EmptyState
          title="Subscribers didn't load"
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <DataTable
            table={table}
            caption="Subscribers"
            isFetching={list.isFetching}
            empty={
              <EmptyState
                icon={MailIcon}
                title="No subscribers"
                description="Sign-ups from the newsletter band appear here."
              />
            }
            renderCard={(row) => (
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-semibold break-all">
                  {row.original.email}
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill tone={TONES[row.original.status] ?? "neutral"}>
                    {LABELS[row.original.status] ?? row.original.status}
                  </StatusPill>
                  <span className="text-xs text-muted-foreground">
                    {formatWhen(
                      row.original.confirmedAt ?? row.original.createdAt
                    )}
                  </span>
                </span>
                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => setRemoving(row.original)}
                  >
                    Delete
                  </Button>
                ) : null}
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
      <RemoveDialog subscriber={removing} onClose={() => setRemoving(null)} />
    </div>
  )
}

function RemoveDialog({
  subscriber,
  onClose,
}: {
  subscriber: SubscriberRow | null
  onClose(): void
}) {
  const client = useQueryClient()
  const remove = useMutation({
    mutationFn: (id: string) =>
      parseResponse(newsletterApi[":id"].$delete({ param: { id } })),
    onSuccess: () => {
      toast.success("Subscriber removed")
      void client.invalidateQueries({ queryKey: queryKeys.newsletter.all })
      onClose()
    },
    onError: (error) => toast.error(error.message),
  })
  return (
    <Dialog
      open={subscriber !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove this subscriber?</DialogTitle>
          <DialogDescription>
            {subscriber?.email} will be deleted from the list. This can&apos;t
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => subscriber && remove.mutate(subscriber.id)}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query"
import { DownloadIcon, ShieldIcon } from "lucide-react"
import { useQueryStates } from "nuqs"
import { useEffect, useState } from "react"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  PageHeader,
  SECONDARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { usePermission } from "@/admin/lib/actor-context"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BOARD_STATUSES } from "@/lib/leads/schema"
import { cn } from "@/lib/utils"

import { LeadDrawer } from "./lead-drawer"
import { LeadsBoard } from "./leads-board"
import { LeadsTable } from "./leads-table"
import { leadsParams } from "./params"
import { PrivacyRequestDialog } from "./privacy-request-dialog"
import { statusLabel } from "./present"
import {
  exportHref,
  leadsListQuery,
  type LeadRow,
  type LeadsListParams,
  type LeadsPage,
} from "./queries"

const PAGE_SIZE = 25
const BOARD_COLUMN_SIZE = 25
const ALL = "__all__"
const STATUS_ITEMS = [
  { value: ALL, label: "All statuses" },
  ...BOARD_STATUSES.map((value) => ({ value, label: statusLabel(value) })),
]

// Every loaded column merged, newest first. A card that was just moved is
// still in its old column's result, so grouping is by its own status.
function boardLeads(pages: (LeadsPage | undefined)[]) {
  const byId = new Map<string, LeadRow>()
  for (const page of pages)
    for (const item of page?.items ?? []) byId.set(item.id, item)
  return [...byId.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
}

export function LeadsView() {
  const [state, setState] = useQueryStates(leadsParams, { history: "replace" })
  const canExport = usePermission({ lead: ["export"] })
  const canPrivacy = usePermission({ lead: ["export"], newsletter: ["export"] })
  const [privacyOpen, setPrivacyOpen] = useState(false)

  // Spam is always a table; the board only holds the inbox.
  const view = state.folder === "spam" ? "table" : state.view
  const params: LeadsListParams = {
    folder: state.folder,
    status: state.folder === "inbox" ? (state.status ?? undefined) : undefined,
    q: state.q || undefined,
    page: Math.max(1, state.page),
    pageSize: PAGE_SIZE,
  }
  const list = useQuery({
    ...leadsListQuery(params),
    placeholderData: keepPreviousData,
    enabled: view === "table",
  })
  // The board asks for each column on its own, so a column's count is the
  // server's total for that status and a busy status cannot push another
  // one out of view.
  const columns = useQueries({
    queries: BOARD_STATUSES.map((status) => ({
      ...leadsListQuery({
        folder: "inbox",
        status,
        q: state.q || undefined,
        page: 1,
        pageSize: BOARD_COLUMN_SIZE,
      }),
      placeholderData: keepPreviousData,
      enabled: view === "board",
    })),
  })

  const [search, setSearch] = useState(state.q)
  useEffect(() => {
    if (search === state.q) return
    const timer = setTimeout(() => void setState({ q: search, page: 1 }), 300)
    return () => clearTimeout(timer)
  }, [search, state.q, setState])

  // ?page=999 lands on the last page rather than an empty one.
  const total = list.data?.total
  const lastPage =
    total === undefined ? undefined : Math.max(1, Math.ceil(total / PAGE_SIZE))
  useEffect(() => {
    if (view === "table" && lastPage !== undefined && state.page > lastPage)
      void setState({ page: lastPage })
  }, [view, lastPage, state.page, setState])

  const open = (id: string) => void setState({ lead: id }, { history: "push" })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Enquiries"
        description="Messages from the contact form. Times are Irish time."
        actions={
          <>
            {canExport ? (
              <a
                href={exportHref({
                  folder: state.folder,
                  status:
                    state.folder === "inbox"
                      ? (state.status ?? undefined)
                      : undefined,
                })}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  SECONDARY_ACTION
                )}
              >
                <DownloadIcon aria-hidden />
                Export CSV
              </a>
            ) : null}
            {canPrivacy ? (
              <Button
                variant="outline"
                className={SECONDARY_ACTION}
                onClick={() => setPrivacyOpen(true)}
              >
                <ShieldIcon aria-hidden />
                Privacy request
              </Button>
            ) : null}
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          value={state.folder}
          onValueChange={(value) =>
            void setState({
              folder: value === "spam" ? "spam" : "inbox",
              status: null,
              page: 1,
            })
          }
        >
          <TabsList>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
            <TabsTrigger value="spam">Spam</TabsTrigger>
          </TabsList>
        </Tabs>
        {state.folder === "inbox" ? (
          <ToggleGroup
            aria-label="View"
            variant="outline"
            value={[view]}
            onValueChange={(next) => {
              const value = next[0]
              if (value === "board" || value === "table")
                void setState({ view: value, page: 1 })
            }}
          >
            <ToggleGroupItem value="board">Board</ToggleGroupItem>
            <ToggleGroupItem value="table">Table</ToggleGroupItem>
          </ToggleGroup>
        ) : null}
        {view === "table" && state.folder === "inbox" ? (
          <Select
            items={STATUS_ITEMS}
            value={state.status ?? ALL}
            onValueChange={(value) =>
              void setState({
                status: value === ALL ? null : (value as never),
                page: 1,
              })
            }
          >
            <SelectTrigger aria-label="Status" className="w-44">
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
        ) : null}
        <Input
          type="search"
          aria-label="Search enquiries"
          placeholder="Search name, email or phone"
          className="w-full sm:ml-auto sm:w-72"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {view === "board" ? (
        columns.some((c) => c.isPending) ? (
          <CardSkeleton />
        ) : columns.find((c) => c.isError) ? (
          <EmptyState
            title="Enquiries didn't load"
            description={columns.find((c) => c.isError)!.error!.message}
            action={
              <Button onClick={() => columns.forEach((c) => void c.refetch())}>
                Try again
              </Button>
            }
          />
        ) : (
          <LeadsBoard
            leads={boardLeads(columns.map((c) => c.data))}
            totals={Object.fromEntries(
              BOARD_STATUSES.map((s, i) => [s, columns[i]!.data?.total])
            )}
            onOpen={open}
          />
        )
      ) : list.isPending ? (
        <CardSkeleton />
      ) : list.isError ? (
        <EmptyState
          title="Enquiries didn't load"
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : (
        <LeadsTable
          rows={list.data.items}
          page={params.page}
          pageSize={PAGE_SIZE}
          total={list.data.total}
          folder={state.folder}
          isFetching={list.isFetching}
          onPageChange={(page) => void setState({ page }, { history: "push" })}
          onOpen={open}
        />
      )}
      <LeadDrawer
        id={state.lead}
        onClose={() => void setState({ lead: null })}
      />
      {canPrivacy ? (
        <PrivacyRequestDialog
          open={privacyOpen}
          onOpenChange={setPrivacyOpen}
        />
      ) : null}
    </div>
  )
}

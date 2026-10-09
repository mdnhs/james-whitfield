"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { formatDistanceToNow } from "date-fns"
import { FileTextIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  PageHeader,
  PRIMARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { DataTable } from "@/admin/components/data-table/data-table"
import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { usePermission } from "@/admin/lib/actor-context"
import { pagesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NewPageInput } from "@/lib/content/page-path"

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
        href={`/admin/pages/${info.row.original.id}`}
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
  const canCreate = usePermission({ page: ["create"] })
  const [creating, setCreating] = useState(false)
  useResetOnHide(() => setCreating(false))
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
        actions={
          canCreate ? (
            <Button
              className={PRIMARY_ACTION}
              onClick={() => setCreating(true)}
            >
              <PlusIcon data-icon="inline-start" />
              New page
            </Button>
          ) : null
        }
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
                href={`/admin/pages/${row.original.id}`}
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
      <NewPageDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

function NewPageDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange(open: boolean): void
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New page</DialogTitle>
          <DialogDescription>
            It starts as an empty draft; nobody sees it until you publish.
          </DialogDescription>
        </DialogHeader>
        <SchemaForm
          schema={NewPageInput}
          defaultValues={{ path: "/", title: "" }}
          submitLabel="Create page"
          onSubmit={async (values) => {
            try {
              const { id } = await parseResponse(
                pagesApi.index.$post({ json: values })
              )
              await queryClient.invalidateQueries({
                queryKey: queryKeys.pages.all,
              })
              router.push(`/admin/pages/${id}`)
            } catch (error) {
              if (!(error instanceof ApiError)) throw error
              return {
                formError: error.message,
                fieldErrors: error.fieldErrors,
              }
            }
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

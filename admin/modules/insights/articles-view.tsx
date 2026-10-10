"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { NewspaperIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  PageHeader,
  PRIMARY_ACTION,
  FORM_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { DataTable } from "@/admin/components/data-table/data-table"
import { DataTablePagination } from "@/admin/components/data-table/data-table-pagination"
import { usePermission } from "@/admin/lib/actor-context"
import { articlesApi, parseResponse } from "@/admin/lib/api"
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Toggle } from "@/components/ui/toggle"
import type { ArticleStatus } from "@/lib/content/article"

import {
  articlesListQuery,
  authorsQuery,
  categoriesQuery,
  type ArticleSummaryRow,
} from "./queries"
import { formatDublin } from "./schedule-time"

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, ArticleSummaryRow>()
const EMPTY: ArticleSummaryRow[] = []
const ALL = "__all__"
const PAGE_SIZE = 25

const STATUS_ITEMS = [
  { value: ALL, label: "All" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
]

export function ArticleStatus({
  status,
  scheduledFor,
  reviewRequestedAt,
}: {
  status: ArticleStatus
  scheduledFor: string | null
  reviewRequestedAt: string | null
}) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {status === "published" ? (
        <StatusPill tone="success">Published</StatusPill>
      ) : status === "scheduled" ? (
        <StatusPill tone="info">
          Scheduled{scheduledFor ? ` · ${formatDublin(scheduledFor)}` : ""}
        </StatusPill>
      ) : status === "archived" ? (
        <StatusPill tone="neutral">Archived</StatusPill>
      ) : (
        <StatusPill tone="neutral">Draft</StatusPill>
      )}
      {reviewRequestedAt ? (
        <StatusPill tone="warning">Review requested</StatusPill>
      ) : null}
    </span>
  )
}

const rowStatus = (row: ArticleSummaryRow) => (
  <ArticleStatus
    status={row.status}
    scheduledFor={row.scheduledFor}
    reviewRequestedAt={row.reviewRequestedAt}
  />
)

const columns = helper.columns([
  helper.accessor("title", {
    header: "Title",
    cell: (info) => (
      <Link
        href={`/admin/insights/${info.row.original.id}`}
        className="font-semibold underline-offset-4 hover:text-primary hover:underline"
      >
        {info.getValue() || "Untitled article"}
      </Link>
    ),
  }),
  helper.display({
    id: "status",
    header: "Status",
    cell: (info) => rowStatus(info.row.original),
  }),
  helper.accessor("category", { header: "Category" }),
  helper.accessor("author", { header: "Author" }),
  helper.accessor("updatedAt", {
    header: "Updated",
    cell: (info) => (
      <time
        dateTime={info.getValue()}
        className="whitespace-nowrap text-muted-foreground"
      >
        {formatDublin(info.getValue())}
      </time>
    ),
  }),
])

function useDebounced<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function ArticlesView() {
  const canCreate = usePermission({ article: ["create"] })
  const [creating, setCreating] = useState(false)
  useResetOnHide(() => setCreating(false))
  const [search, setSearch] = useState("")
  const q = useDebounced(search.trim(), 300)
  const [status, setStatus] = useState<ArticleStatus | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [review, setReview] = useState(false)
  const [page, setPage] = useState(1)
  const categories = useQuery(categoriesQuery())
  const list = useQuery(
    articlesListQuery({
      q,
      status: status ?? undefined,
      categoryId: categoryId ?? undefined,
      review,
      page,
      pageSize: PAGE_SIZE,
    })
  )
  const table = useTable({
    features,
    columns,
    data: list.data?.items ?? EMPTY,
    getRowId: (row) => row.id,
  })
  const filtered = Boolean(q || status || categoryId || review)
  const newButton = canCreate ? (
    <Button className={PRIMARY_ACTION} onClick={() => setCreating(true)}>
      <PlusIcon data-icon="inline-start" />
      New article
    </Button>
  ) : null
  const categoryItems = [
    { value: ALL, label: "All categories" },
    ...(categories.data?.items ?? []).map((c) => ({
      value: c.id,
      label: c.name,
    })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Insights"
        description="Articles for the Insights section. Changes stay in a draft until you publish."
        actions={newButton}
      />
      <div className="flex flex-wrap items-end gap-3">
        <Field className="w-full sm:w-64">
          <FieldLabel htmlFor="articles-search">Search articles</FieldLabel>
          <Input
            id="articles-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
        </Field>
        <Field className="w-full sm:w-44">
          <FieldLabel htmlFor="articles-status">Status</FieldLabel>
          <Select
            items={STATUS_ITEMS}
            value={status ?? ALL}
            onValueChange={(value) => {
              setStatus(value === ALL ? null : (value as ArticleStatus))
              setPage(1)
            }}
          >
            <SelectTrigger id="articles-status" className="w-full">
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
        <Field className="w-full sm:w-56">
          <FieldLabel htmlFor="articles-category">Category</FieldLabel>
          <Select
            items={categoryItems}
            value={categoryId ?? ALL}
            onValueChange={(value) => {
              setCategoryId(value === ALL ? null : String(value))
              setPage(1)
            }}
          >
            <SelectTrigger id="articles-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Toggle
          variant="outline"
          className="h-9"
          pressed={review}
          onPressedChange={(next) => {
            setReview(next)
            setPage(1)
          }}
        >
          Review requested
        </Toggle>
      </div>
      {list.isPending ? (
        <CardSkeleton />
      ) : list.isError ? (
        <EmptyState
          title="The articles didn't load"
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <DataTable
            table={table}
            caption="Articles"
            isFetching={list.isFetching}
            empty={
              <EmptyState
                icon={NewspaperIcon}
                title={filtered ? "No matching articles" : "No articles yet"}
                description={
                  filtered
                    ? "Try a different search or clear the filters."
                    : "Articles you write appear here, with their status."
                }
                action={filtered ? undefined : (newButton ?? undefined)}
              />
            }
            renderCard={(row) => (
              <div className="flex flex-col gap-2 text-sm">
                <Link
                  href={`/admin/insights/${row.original.id}`}
                  className="font-semibold"
                >
                  {row.original.title || "Untitled article"}
                </Link>
                {rowStatus(row.original)}
                <p className="text-xs text-muted-foreground">
                  {row.original.category} · {row.original.author} · Updated{" "}
                  {formatDublin(row.original.updatedAt)}
                </p>
              </div>
            )}
          />
          <DataTablePagination
            page={page}
            pageSize={PAGE_SIZE}
            total={list.data.total}
            onPageChange={setPage}
          />
        </>
      )}
      <NewArticleDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}

function NewArticleDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange(open: boolean): void
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const canPickAuthor = usePermission({ article: ["publish"] })
  const categories = useQuery({ ...categoriesQuery(), enabled: open })
  const authors = useQuery({
    ...authorsQuery(),
    enabled: open && canPickAuthor,
  })
  const [title, setTitle] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [authorId, setAuthorId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  useResetOnHide(() => {
    setTitle("")
    setCategoryId(null)
    setAuthorId(null)
    setErrors({})
    setFormError(null)
  })
  const categoryItems = (categories.data?.items ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }))
  const authorItems = (authors.data?.items ?? []).map((a) => ({
    value: a.id,
    label: a.name,
  }))
  const author = authorId ?? authorItems[0]?.value ?? null

  const create = useMutation({
    mutationFn: () =>
      parseResponse(
        articlesApi.index.$post({
          json: {
            title,
            categoryId: categoryId ?? "",
            ...(canPickAuthor && author ? { authorId: author } : {}),
          },
        })
      ),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.articles.all })
      router.push(`/admin/insights/${id}`)
    },
    onError: (error) => {
      setFormError(error.message)
      setErrors(error instanceof ApiError ? (error.fieldErrors ?? {}) : {})
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New article</DialogTitle>
          <DialogDescription>
            It starts as a draft; nobody sees it until it is published.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            setErrors({})
            setFormError(null)
            if (!title.trim() || !categoryId) {
              setErrors({
                ...(title.trim() ? {} : { title: ["Enter a title"] }),
                ...(categoryId ? {} : { categoryId: ["Choose a category"] }),
              })
              return
            }
            create.mutate()
          }}
        >
          <FieldGroup>
            <Field data-invalid={errors.title ? true : undefined}>
              <FieldLabel htmlFor="new-article-title">Title</FieldLabel>
              <Input
                id="new-article-title"
                value={title}
                maxLength={120}
                aria-invalid={errors.title ? true : undefined}
                onChange={(event) => setTitle(event.target.value)}
              />
              {errors.title?.[0] ? (
                <FieldError>{errors.title[0]}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={errors.categoryId ? true : undefined}>
              <FieldLabel htmlFor="new-article-category">Category</FieldLabel>
              <Select
                items={categoryItems}
                value={categoryId}
                onValueChange={(value) => setCategoryId(String(value))}
              >
                <SelectTrigger
                  id="new-article-category"
                  className="w-full"
                  aria-invalid={errors.categoryId ? true : undefined}
                >
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {categoryItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId?.[0] ? (
                <FieldError>{errors.categoryId[0]}</FieldError>
              ) : null}
            </Field>
            {canPickAuthor ? (
              <Field data-invalid={errors.authorId ? true : undefined}>
                <FieldLabel htmlFor="new-article-author">Author</FieldLabel>
                <Select
                  items={authorItems}
                  value={author}
                  onValueChange={(value) => setAuthorId(String(value))}
                >
                  <SelectTrigger id="new-article-author" className="w-full">
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {authorItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.authorId?.[0] ? (
                  <FieldError>{errors.authorId[0]}</FieldError>
                ) : null}
              </Field>
            ) : null}
          </FieldGroup>
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
          <div>
            <Button
              type="submit"
              className={FORM_ACTION}
              disabled={create.isPending || create.isSuccess}
            >
              {create.isPending ? <Spinner data-icon="inline-start" /> : null}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

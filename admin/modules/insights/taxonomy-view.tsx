"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  createColumnHelper,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { PlusIcon, TagsIcon, UserRoundIcon } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import type * as z from "zod"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  PageHeader,
  PRIMARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { DataTable } from "@/admin/components/data-table/data-table"
import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { Thumb } from "@/admin/components/schema-form/widgets/media-picker-dialog"
import { usePermission } from "@/admin/lib/actor-context"
import { authorsApi, categoriesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"
import { mediaListQuery } from "@/admin/modules/media/queries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  AuthorInput,
  CategoryInput,
  type Taxonomy,
} from "@/lib/content/taxonomy"

import { authorsQuery, categoriesQuery, type TaxonomyItem } from "./queries"

const features = tableFeatures({})
const helper = createColumnHelper<typeof features, TaxonomyItem>()
const EMPTY: TaxonomyItem[] = []

const NOUN = {
  categories: { one: "category", title: "Categories", new: "New category" },
  authors: { one: "author", title: "Authors", new: "New author" },
} as const

const OVERRIDES = {
  categories: {
    slug: { label: "Slug" },
    name: { label: "Name" },
    description: { label: "Description" },
    relatedServiceId: {
      label: "Related service",
      widget: "collection",
      collection: "services",
    },
    isVisible: { label: "Visible on the site" },
  },
  authors: {
    slug: { label: "Slug" },
    name: { label: "Name" },
    roleTitle: { label: "Role title" },
    bio: { label: "Bio", widget: "textarea" },
    avatar: { label: "Photo" },
    isVisible: { label: "Visible on the site" },
  },
} as const

const NEW_VALUES = {
  categories: {
    slug: "",
    name: "",
    description: "",
    relatedServiceId: null,
    isVisible: true,
  },
  authors: {
    slug: "",
    name: "",
    roleTitle: "",
    bio: "",
    avatar: null,
    isVisible: true,
  },
} as const

function valuesOf(name: Taxonomy, item: TaxonomyItem) {
  return name === "categories"
    ? {
        slug: item.slug,
        name: item.name,
        description: item.description ?? "",
        relatedServiceId: item.relatedServiceId ?? null,
        isVisible: item.isVisible,
      }
    : {
        slug: item.slug,
        name: item.name,
        roleTitle: item.roleTitle ?? "",
        bio: item.bio ?? "",
        avatar: item.avatar ?? null,
        isVisible: item.isVisible,
      }
}

// "new" = creating; a row = editing it; null = closed.
type Editing = "new" | TaxonomyItem | null

export function TaxonomyView({ name }: { name: Taxonomy }) {
  const noun = NOUN[name]
  const categoryList = useQuery({
    ...categoriesQuery(),
    enabled: name === "categories",
  })
  const authorList = useQuery({
    ...authorsQuery(),
    enabled: name === "authors",
  })
  const list = name === "categories" ? categoryList : authorList
  const canManage = usePermission({ article: ["publish"] })
  const [editing, setEditing] = useState<Editing>(null)
  const [deleting, setDeleting] = useState<TaxonomyItem | null>(null)
  useResetOnHide(() => {
    setEditing(null)
    setDeleting(null)
  })
  const items = list.data?.items ?? EMPTY
  const avatarIds = useMemo(
    () =>
      name === "authors"
        ? items.flatMap((item) => (item.avatar ? [item.avatar.mediaId] : []))
        : [],
    [items, name]
  )
  const avatars = useQuery({
    ...mediaListQuery({ ids: avatarIds }),
    enabled: avatarIds.length > 0,
  })
  const avatarById = useMemo(
    () => new Map((avatars.data?.items ?? []).map((m) => [m.id, m])),
    [avatars.data]
  )

  const columns = useMemo(
    () =>
      helper.columns([
        ...(name === "authors"
          ? [
              helper.display({
                id: "avatar",
                header: "Photo",
                cell: (info) => {
                  const media = info.row.original.avatar
                    ? avatarById.get(info.row.original.avatar.mediaId)
                    : undefined
                  return (
                    <span className="flex size-10 items-center justify-center overflow-hidden rounded-full border bg-muted">
                      {media ? (
                        <Thumb item={media} />
                      ) : (
                        <UserRoundIcon
                          aria-hidden
                          className="size-4 text-muted-foreground"
                        />
                      )}
                    </span>
                  )
                },
              }),
            ]
          : []),
        helper.accessor("name", {
          header: "Name",
          cell: (info) => (
            <span className="font-semibold">{info.getValue()}</span>
          ),
        }),
        helper.accessor("slug", {
          header: "Slug",
          cell: (info) => (
            <code className="font-mono text-xs text-muted-foreground">
              {info.getValue()}
            </code>
          ),
        }),
        helper.accessor("articleCount", { header: "Articles" }),
        helper.accessor("isVisible", {
          header: "Visible",
          cell: (info) => (
            <StatusPill tone={info.getValue() ? "success" : "neutral"}>
              {info.getValue() ? "Visible" : "Hidden"}
            </StatusPill>
          ),
        }),
        ...(canManage
          ? [
              helper.display({
                id: "actions",
                header: () => <span className="sr-only">Actions</span>,
                cell: (info) => (
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Edit ${info.row.original.name}`}
                      onClick={() => setEditing(info.row.original)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${info.row.original.name}`}
                      onClick={() => setDeleting(info.row.original)}
                    >
                      Delete
                    </Button>
                  </span>
                ),
              }),
            ]
          : []),
      ]),
    [avatarById, canManage, name]
  )
  const table = useTable({
    features,
    columns,
    data: items,
    getRowId: (row) => row.id,
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={noun.title}
        description={
          name === "categories"
            ? "Group articles. Each category can point readers at a service."
            : "People credited on articles."
        }
        actions={
          canManage ? (
            <Button
              className={PRIMARY_ACTION}
              onClick={() => setEditing("new")}
            >
              <PlusIcon data-icon="inline-start" />
              {noun.new}
            </Button>
          ) : null
        }
      />
      {list.isPending ? (
        <CardSkeleton />
      ) : list.isError ? (
        <EmptyState
          title={`The ${noun.title.toLowerCase()} didn't load`}
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : (
        <DataTable
          table={table}
          caption={noun.title}
          empty={
            <EmptyState
              icon={TagsIcon}
              title={`No ${noun.title.toLowerCase()} yet`}
              description="They appear here once they are created."
            />
          }
          renderCard={(row) => (
            <div className="flex flex-col gap-2 text-sm">
              <span className="font-semibold">{row.original.name}</span>
              <code className="font-mono text-xs text-muted-foreground">
                {row.original.slug}
              </code>
              <p className="text-xs text-muted-foreground">
                {row.original.articleCount} articles ·{" "}
                {row.original.isVisible ? "Visible" : "Hidden"}
              </p>
              {canManage ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Edit ${row.original.name}`}
                    onClick={() => setEditing(row.original)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${row.original.name}`}
                    onClick={() => setDeleting(row.original)}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        />
      )}
      <EditSheet
        name={name}
        editing={editing}
        onClose={() => setEditing(null)}
      />
      <DeleteDialog
        name={name}
        item={deleting}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

function EditSheet({
  name,
  editing,
  onClose,
}: {
  name: Taxonomy
  editing: Editing
  onClose(): void
}) {
  const noun = NOUN[name]
  const queryClient = useQueryClient()
  const api = name === "categories" ? categoriesApi : authorsApi
  const schema = name === "categories" ? CategoryInput : AuthorInput
  return (
    <Sheet open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="text-lg font-semibold">
            {editing === "new" ? noun.new : `Edit ${noun.one}`}
          </SheetTitle>
          <SheetDescription>
            Changes go live on the site when you save.
          </SheetDescription>
        </SheetHeader>
        <div className="p-5">
          {editing ? (
            <SchemaForm
              schema={schema as z.ZodObject}
              defaultValues={
                editing === "new"
                  ? { ...NEW_VALUES[name] }
                  : valuesOf(name, editing)
              }
              overrides={OVERRIDES[name]}
              submitLabel="Save"
              onSubmit={async (values) => {
                try {
                  if (editing === "new") {
                    await parseResponse(
                      api.index.$post({
                        json: values as Record<string, unknown>,
                      })
                    )
                  } else {
                    await parseResponse(
                      api[":id"].$patch({
                        param: { id: editing.id },
                        json: {
                          version: editing.version,
                          values: values as Record<string, unknown>,
                        },
                      })
                    )
                  }
                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: queryKeys[name],
                    }),
                    queryClient.invalidateQueries({
                      queryKey: queryKeys.articles.all,
                    }),
                  ])
                  toast.success("Saved")
                  onClose()
                } catch (error) {
                  if (!(error instanceof ApiError)) throw error
                  // Someone saved first: this row's version is stale, so
                  // reload the list and close rather than 409 on every retry.
                  if (error.code === "CONFLICT" && editing !== "new") {
                    await queryClient.invalidateQueries({
                      queryKey: queryKeys[name],
                    })
                    toast.error(error.message)
                    onClose()
                    return
                  }
                  return {
                    formError: error.message,
                    fieldErrors: error.fieldErrors,
                  }
                }
              }}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// A Dialog stands in for an AlertDialog (the admin has no such primitive).
function DeleteDialog({
  name,
  item,
  onClose,
}: {
  name: Taxonomy
  item: TaxonomyItem | null
  onClose(): void
}) {
  const noun = NOUN[name]
  const queryClient = useQueryClient()
  const api = name === "categories" ? categoriesApi : authorsApi
  const remove = useMutation({
    mutationFn: (id: string) =>
      parseResponse(api[":id"].$delete({ param: { id } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys[name] })
      toast.success(`Deleted`)
      onClose()
    },
    // A 409 carries the reason ("used by 3 articles").
    onError: (error) => {
      toast.error(error.message)
      onClose()
    },
  })
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this {noun.one}?</DialogTitle>
          <DialogDescription>
            {item?.name} will be removed. A {noun.one} that articles use
            can&apos;t be deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => item && remove.mutate(item.id)}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

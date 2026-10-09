"use client"

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { GripVerticalIcon, LayersIcon, PlusIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import {
  PageHeader,
  PRIMARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { usePermission } from "@/admin/lib/actor-context"
import { collectionsApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COLLECTION_LABELS,
  type CollectionSlug,
} from "@/lib/content/collections"
import { cn } from "@/lib/utils"

import { ITEM_NOUN } from "./collection-ui"
import { ItemSheet, type EditableItem } from "./item-sheet"
import { collectionListQuery, type CollectionItem as Item } from "./queries"

const NONE: Item[] = []
const usedOn = (item: Item) => item.usedOn.join(", ") || "Not used"
const isVisible = (item: Item) => item.values.isVisible !== false

export function CollectionView({ name }: { name: CollectionSlug }) {
  const queryClient = useQueryClient()
  const list = useQuery(collectionListQuery(name))
  const canCreate = usePermission({ collection: ["create"] })
  const canUpdate = usePermission({ collection: ["update"] })
  const canDelete = usePermission({ collection: ["delete"] })
  const [editing, setEditing] = useState<EditableItem | "new" | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  useResetOnHide(() => {
    setEditing(null)
    setDeleting(null)
  })
  const noun = ITEM_NOUN[name]
  const key = queryKeys.collections.list(name)
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const items = list.data?.items ?? NONE

  const setBusyFor = (id: string, on: boolean) =>
    setBusy((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  async function toggleVisible(item: Item, next: boolean) {
    setBusyFor(item.id, true)
    queryClient.setQueryData(key, (data: typeof list.data) =>
      data
        ? {
            ...data,
            items: data.items.map((row) =>
              row.id === item.id
                ? { ...row, values: { ...row.values, isVisible: next } }
                : row
            ),
          }
        : data
    )
    try {
      await parseResponse(
        collectionsApi[":name"][":id"].$patch({
          param: { name, id: item.id },
          json: { version: item.version, values: { isVisible: next } },
        })
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't change visibility"
      )
    } finally {
      await refresh()
      setBusyFor(item.id, false)
    }
  }

  async function reorder(from: number, to: number) {
    const ids = arrayMove(
      items.map((item) => item.id),
      from,
      to
    )
    queryClient.setQueryData(key, (data: typeof list.data) =>
      data
        ? {
            ...data,
            items: ids.map(
              (id) => data.items.find((row) => row.id === id) ?? data.items[0]!
            ),
          }
        : data
    )
    try {
      await parseResponse(
        collectionsApi[":name"].order.$patch({ param: { name }, json: { ids } })
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't save the new order"
      )
    } finally {
      // Also rolls back an order the server refused.
      await refresh()
    }
  }

  async function remove(item: Item) {
    try {
      await parseResponse(
        collectionsApi[":name"][":id"].$delete({ param: { name, id: item.id } })
      )
      toast.success("Deleted")
      setDeleting(null)
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "Couldn't delete"
      )
      setDeleting(null)
    } finally {
      await refresh()
    }
  }

  const open = (item: Item) =>
    setEditing({ id: item.id, version: item.version, values: item.values })

  const actions = (item: Item) => (
    <span className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={() => open(item)}>
        {canUpdate ? "Edit" : "View"}
      </Button>
      {canDelete ? (
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-danger-soft hover:text-danger text-muted-foreground"
          aria-label={`Delete ${item.title}`}
          onClick={() => setDeleting(item)}
        >
          Delete
        </Button>
      ) : null}
    </span>
  )

  const visibility = (item: Item) => (
    <span className="flex items-center gap-2">
      <Switch
        aria-label={`Show ${item.title}`}
        checked={isVisible(item)}
        disabled={!canUpdate || busy.has(item.id)}
        onCheckedChange={(next) => void toggleVisible(item, next)}
      />
      {isVisible(item) ? null : <StatusPill tone="neutral">Hidden</StatusPill>}
    </span>
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={COLLECTION_LABELS[name]}
        description="Saved changes are live straight away. Drag rows to change the order on the site."
        actions={
          canCreate ? (
            <Button
              className={PRIMARY_ACTION}
              onClick={() => setEditing("new")}
            >
              <PlusIcon data-icon="inline-start" />
              {`Add ${noun}`}
            </Button>
          ) : null
        }
      />
      {list.isPending ? (
        <CardSkeleton />
      ) : list.isError ? (
        <EmptyState
          title="This list didn't load"
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={LayersIcon}
          title={`No ${COLLECTION_LABELS[name].toLowerCase()} yet`}
          description={
            canCreate
              ? `Add the first ${noun} to see it here.`
              : "Nothing has been added yet."
          }
        />
      ) : (
        <>
          <SortableRoot
            items={items}
            onMove={(from, to) => void reorder(from, to)}
            disabled={!canUpdate}
          >
            <ul
              role="list"
              aria-label={COLLECTION_LABELS[name]}
              className="flex flex-col gap-3 sm:hidden"
            >
              {items.map((item) => (
                <SortableRow
                  key={item.id}
                  as="li"
                  id={item.id}
                  title={item.title}
                  disabled={!canUpdate}
                  className="rounded-card flex flex-col gap-3 bg-card p-4"
                >
                  {(handle) => (
                    <>
                      <div className="flex items-start gap-2">
                        {handle}
                        <p className="min-w-0 flex-1 font-semibold break-words">
                          {item.title}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Used on: {usedOn(item)}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        {visibility(item)}
                        {actions(item)}
                      </div>
                    </>
                  )}
                </SortableRow>
              ))}
            </ul>
          </SortableRoot>
          <div className="rounded-card hidden overflow-hidden bg-card sm:block">
            <SortableRoot
              items={items}
              onMove={(from, to) => void reorder(from, to)}
              disabled={!canUpdate}
            >
              <Table>
                <TableCaption className="sr-only">
                  {COLLECTION_LABELS[name]}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="h-12 w-12 px-4">
                      <span className="sr-only">Order</span>
                    </TableHead>
                    <TableHead scope="col" className="h-12 px-4">
                      Title
                    </TableHead>
                    <TableHead scope="col" className="h-12 px-4">
                      Used on
                    </TableHead>
                    <TableHead scope="col" className="h-12 px-4">
                      Visible
                    </TableHead>
                    <TableHead scope="col" className="h-12 px-4">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <SortableRow
                      key={item.id}
                      as="tr"
                      id={item.id}
                      title={item.title}
                      disabled={!canUpdate}
                    >
                      {(handle) => (
                        <>
                          <TableCell className="px-4 py-3">{handle}</TableCell>
                          <TableCell className="max-w-72 px-4 py-3 font-semibold break-words whitespace-normal">
                            {item.title}
                          </TableCell>
                          <TableCell className="max-w-64 px-4 py-3 whitespace-normal text-muted-foreground">
                            {usedOn(item)}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {visibility(item)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            {actions(item)}
                          </TableCell>
                        </>
                      )}
                    </SortableRow>
                  ))}
                </TableBody>
              </Table>
            </SortableRoot>
          </div>
        </>
      )}
      <ItemSheet
        name={name}
        item={editing}
        readOnly={editing !== "new" && !canUpdate}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
      >
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader className="gap-3">
            <DialogTitle className="text-lg font-semibold">
              {`Delete “${deleting?.title ?? ""}”?`}
            </DialogTitle>
            <DialogDescription>
              Items a page names (chosen FAQs, a band) can&apos;t be deleted
              until the page stops using them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 rounded-b-xl border-t bg-muted/50 p-4 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && void remove(deleting)}
            >
              Delete for good
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Drag with the handle or the keyboard (space, arrows, space): docs/brief.md
// §9.4. Announcements name the row, not its uuid.
function SortableRoot({
  items,
  onMove,
  disabled,
  children,
}: {
  items: readonly Item[]
  onMove(from: number, to: number): void
  disabled: boolean
  children: React.ReactNode
}) {
  const id = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const describe = (rowId: UniqueIdentifier | undefined) => {
    const index = items.findIndex((item) => item.id === rowId)
    return index >= 0
      ? `${items[index]!.title}, position ${index + 1} of ${items.length}`
      : "a row"
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active.id)}.`,
    onDragOver: ({ over }) =>
      over ? `Over ${describe(over.id)}.` : "Not over a row.",
    onDragEnd: ({ over }) =>
      over ? `Dropped at ${describe(over.id)}.` : "Dropped.",
    onDragCancel: () => "Reordering cancelled.",
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = items.findIndex((item) => item.id === active.id)
    const to = items.findIndex((item) => item.id === over.id)
    if (from >= 0 && to >= 0) onMove(from, to)
  }
  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={disabled ? undefined : onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Press space to pick up the row, the arrow keys to move it, space to drop it, or escape to cancel.",
        },
      }}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  as: Tag,
  id,
  title,
  disabled,
  className,
  children,
}: {
  as: "tr" | "li"
  id: string
  title: string
  disabled: boolean
  className?: string
  children: (handle: React.ReactNode) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })
  const handle = disabled ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      aria-label={`Reorder ${title}`}
      className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVerticalIcon aria-hidden className="size-4" />
    </button>
  )
  return (
    <Tag
      ref={setNodeRef as never}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        Tag === "tr" && "border-b transition-colors hover:bg-muted/50",
        isDragging && "relative z-10 bg-card shadow-lg",
        className
      )}
    >
      {children(handle)}
    </Tag>
  )
}

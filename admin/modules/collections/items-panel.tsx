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
import { GripVerticalIcon, PlusIcon } from "lucide-react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { usePermission } from "@/admin/lib/actor-context"
import { collectionsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { useResetOnHide } from "@/admin/lib/use-reset-on-hide"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  COLLECTION_LABELS,
  type CollectionSlug,
} from "@/lib/content/collections"
import { cn } from "@/lib/utils"

import { ITEM_NOUN } from "./collection-ui"
import { ItemSheet, type EditableItem } from "./item-sheet"
import { collectionListQuery, type CollectionItem as Item } from "./queries"

const NONE: Item[] = []
const isVisible = (item: Item) => item.values.isVisible !== false

// The items a section shows, edited in place. They stay rows in their
// collection, so a change here is live on every page that shows them.
// `readOnly` is the page's own rights; the collection's rights apply too.
export function ItemsPanel({
  name,
  pageTitle,
  readOnly,
}: {
  name: CollectionSlug
  pageTitle: string
  readOnly: boolean
}) {
  const queryClient = useQueryClient()
  const list = useQuery(collectionListQuery(name))
  const canCreate = usePermission({ collection: ["create"] }) && !readOnly
  const canUpdate = usePermission({ collection: ["update"] }) && !readOnly
  const canDelete = usePermission({ collection: ["delete"] }) && !readOnly
  const [editing, setEditing] = useState<EditableItem | "new" | null>(null)
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  useResetOnHide(() => setEditing(null))
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

  // A 409 (still named on a page) carries the server's own explanation.
  async function remove(item: Item) {
    try {
      await parseResponse(
        collectionsApi[":name"][":id"].$delete({ param: { name, id: item.id } })
      )
      toast.success("Removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove")
    } finally {
      await refresh()
    }
  }

  const alsoOn = (item: Item) => item.usedOn.filter((p) => p !== pageTitle)

  return (
    <section
      aria-label={COLLECTION_LABELS[name]}
      className="flex flex-col gap-3 border-t pt-6"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold">
            {COLLECTION_LABELS[name]}
          </h3>
          <p className="text-sm text-muted-foreground">
            Shared: a saved change is live everywhere these are shown.
          </p>
        </div>
        {canCreate ? (
          <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
            <PlusIcon data-icon="inline-start" />
            {`Add ${noun}`}
          </Button>
        ) : null}
      </div>
      {list.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.isError ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-danger">{list.error.message}</span>
          <Button variant="outline" size="sm" onClick={() => list.refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {`No ${COLLECTION_LABELS[name].toLowerCase()} yet.`}
        </p>
      ) : (
        <SortableRoot
          items={items}
          onMove={(from, to) => void reorder(from, to)}
          disabled={!canUpdate}
        >
          <ul role="list" className="flex flex-col gap-2">
            {items.map((item) => {
              const others = alsoOn(item)
              return (
                <SortableRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  disabled={!canUpdate}
                  className="rounded-card flex flex-wrap items-center gap-2 bg-card p-3"
                >
                  {(handle) => (
                    <>
                      {handle}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold break-words">
                          {item.title}
                        </p>
                        {others.length > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {`Also shown on: ${others.join(", ")}`}
                          </p>
                        ) : null}
                      </div>
                      <span className="flex items-center gap-2">
                        <Switch
                          aria-label={`Show ${item.title}`}
                          checked={isVisible(item)}
                          disabled={!canUpdate || busy.has(item.id)}
                          onCheckedChange={(next) =>
                            void toggleVisible(item, next)
                          }
                        />
                        {isVisible(item) ? null : (
                          <StatusPill tone="neutral">Hidden</StatusPill>
                        )}
                      </span>
                      {canUpdate ? (
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`Edit ${item.title}`}
                          onClick={() =>
                            setEditing({
                              id: item.id,
                              version: item.version,
                              values: item.values,
                            })
                          }
                        >
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-danger-soft hover:text-danger text-muted-foreground"
                          aria-label={`Remove ${item.title}`}
                          onClick={() => void remove(item)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </>
                  )}
                </SortableRow>
              )
            })}
          </ul>
        </SortableRoot>
      )}
      <ItemSheet
        name={name}
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </section>
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
  id,
  title,
  disabled,
  className,
  children,
}: {
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
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 bg-card shadow-lg", className)}
    >
      {children(handle)}
    </li>
  )
}

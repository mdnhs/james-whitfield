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
import { GripVerticalIcon, LinkIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { toast } from "sonner"

import {
  DeleteIconButton,
  EditIconButton,
} from "@/admin/components/actions/icon-actions"
import { IconTip, InfoHint } from "@/admin/components/actions/icon-tip"
import { usePermission } from "@/admin/lib/actor-context"
import { collectionsApi, parseResponse, servicePagesApi } from "@/admin/lib/api"
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
  COLLECTION_LABELS,
  type CollectionSlug,
} from "@/lib/content/collections"
import { cn } from "@/lib/utils"

import { ITEM_NOUN } from "./collection-ui"
import { ItemSheet, type EditableItem } from "./item-sheet"
import { collectionListQuery, type CollectionItem as Item } from "./queries"

const NONE: Item[] = []
const isVisible = (item: Item) => item.values.isVisible !== false
// Only services carry one: deleting the service deletes the page too.
const detailPageOf = (item: Item | null) =>
  item && "detailPage" in item ? item.detailPage : null

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
  const sharedId = useId()
  const canCreate = usePermission({ collection: ["create"] }) && !readOnly
  const canUpdate = usePermission({ collection: ["update"] }) && !readOnly
  const canDelete = usePermission({ collection: ["delete"] }) && !readOnly
  const [editing, setEditing] = useState<EditableItem | "new" | null>(null)
  const router = useRouter()
  // A service is edited on its own page (card, details page and SEO).
  const ownEditor = (id: string) =>
    name === "services" ? `/admin/website/services/${id}` : null
  // Every service has a details page: make any that are missing, once.
  const ensured = useRef(false)
  useEffect(() => {
    if (name !== "services" || !canCreate || ensured.current) return
    ensured.current = true
    void parseResponse(servicePagesApi.ensure.$post()).catch(() => {})
  }, [name, canCreate])
  const [removing, setRemoving] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  useResetOnHide(() => {
    setEditing(null)
    setRemoving(null)
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

  // A 409 (still named on a page) carries the server's own explanation.
  async function remove(item: Item) {
    if (deleting) return
    setDeleting(true)
    try {
      await parseResponse(
        collectionsApi[":name"][":id"].$delete({ param: { name, id: item.id } })
      )
      toast.success("Removed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove")
    } finally {
      setRemoving(null)
      setDeleting(false)
      await refresh()
      // A service takes its details page with it.
      if (name === "services") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.pages.all })
      }
    }
  }

  const removingPage = detailPageOf(removing)
  const alsoOn = (item: Item) => item.usedOn.filter((p) => p !== pageTitle)

  return (
    <section
      aria-label={COLLECTION_LABELS[name]}
      className="flex flex-col gap-3 border-t pt-6"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[15px] font-semibold">
            {COLLECTION_LABELS[name]}
          </h3>
          <InfoHint id={`${sharedId}-shared`}>
            Shared: a saved change is live everywhere these are shown.
          </InfoHint>
        </div>
        {canCreate ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              name === "services"
                ? router.push("/admin/website/services/new")
                : setEditing("new")
            }
          >
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
                      <p className="min-w-0 flex-1 font-semibold break-words">
                        {item.title}
                      </p>
                      {others.length > 0 ? (
                        <AlsoShownOn pages={others} />
                      ) : null}
                      {/* The switch alone says whether it shows; no label. */}
                      <Switch
                        aria-label={`Show ${item.title}`}
                        checked={isVisible(item)}
                        disabled={!canUpdate || busy.has(item.id)}
                        onCheckedChange={(next) =>
                          void toggleVisible(item, next)
                        }
                      />
                      {canUpdate || ownEditor(item.id) ? (
                        <EditIconButton
                          label={`Edit ${item.title}`}
                          onClick={() => {
                            const href = ownEditor(item.id)
                            if (href) return router.push(href)
                            setEditing({
                              id: item.id,
                              version: item.version,
                              values: item.values,
                            })
                          }}
                        />
                      ) : null}
                      {canDelete ? (
                        <DeleteIconButton
                          label={`Remove ${item.title}`}
                          onClick={() => setRemoving(item)}
                        />
                      ) : null}
                    </>
                  )}
                </SortableRow>
              )
            })}
          </ul>
        </SortableRoot>
      )}
      <Dialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
      >
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader className="gap-3">
            <DialogTitle className="text-lg font-semibold">
              {`Remove ${removing?.title ?? ""}?`}
            </DialogTitle>
            <DialogDescription>
              {removing && removing.usedOn.length > 0
                ? `It is shown on: ${removing.usedOn.join(", ")}.`
                : "It isn't shown on any page."}{" "}
              This removes it everywhere.
              {removingPage &&
                ` This also deletes its details page at ${removingPage.path} (${removingPage.status === "published" ? "Published" : "Draft"}).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 rounded-b-xl border-t bg-muted/50 p-4 sm:justify-end">
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => removing && void remove(removing)}
            >
              <Trash2Icon aria-hidden data-icon="inline-start" />
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ItemSheet
        name={name}
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
        onCreated={(id) => {
          const href = ownEditor(id)
          if (href) router.push(href)
        }}
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

// The other pages that show a row: a link icon with their count, the
// names in a tooltip (and as the badge's accessible name).
function AlsoShownOn({ pages }: { pages: readonly string[] }) {
  const label = `Also shown on: ${pages.join(", ")}`
  return (
    <IconTip label={label}>
      <span
        role="img"
        tabIndex={0}
        aria-label={label}
        className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <LinkIcon aria-hidden className="size-3.5" />
        {pages.length}
      </span>
    </IconTip>
  )
}

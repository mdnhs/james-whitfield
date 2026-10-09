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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  Link2Icon,
  TrashIcon,
} from "lucide-react"
import { useId } from "react"

import { StatusPill } from "@/admin/components/dashboard/status-pill"
import type { DraftBlock, DraftDocument } from "@/blocks/page"
import { BLOCK_BY_TYPE } from "@/blocks/registry"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { BLOCK_ICONS } from "./block-icons"

type Props = {
  doc: DraftDocument
  selectedId: string | null
  invalidIds: ReadonlySet<string>
  readOnly: boolean
  onSelect(id: string): void
  onMove(from: number, to: number): void
  onToggleHidden(block: DraftBlock): void
  onRemove(id: string): void
}

// Drag with the handle or the keyboard (space, arrows, space): docs/brief.md
// §9.4 asks for keyboard drag-and-drop.
export function BlockOutline({ doc, onMove, ...rest }: Props) {
  const id = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = doc.blocks.findIndex((b) => b.id === active.id)
    const to = doc.blocks.findIndex((b) => b.id === over.id)
    if (from >= 0 && to >= 0) onMove(from, to)
  }
  // dnd-kit's default announcements read the raw ids (uuids).
  const describe = (blockId: UniqueIdentifier | undefined) => {
    const index = doc.blocks.findIndex((b) => b.id === blockId)
    const block = doc.blocks[index]
    return block
      ? `${BLOCK_BY_TYPE[block.type].label}, position ${index + 1} of ${doc.blocks.length}`
      : "a block"
  }
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${describe(active.id)}.`,
    onDragOver: ({ over }) =>
      over ? `Over ${describe(over.id)}.` : "Not over a block.",
    onDragEnd: ({ over }) =>
      over ? `Dropped at ${describe(over.id)}.` : "Dropped.",
    onDragCancel: () => "Reordering cancelled.",
  }
  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Press space to pick up the block, the arrow keys to move it, space to drop it, or escape to cancel.",
        },
      }}
    >
      <SortableContext
        items={doc.blocks.map((b) => b.id)}
        strategy={rectSortingStrategy}
      >
        <ol
          aria-label="Blocks"
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"
        >
          {doc.blocks.map((block, index) => (
            <OutlineItem key={block.id} block={block} index={index} {...rest} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

function OutlineItem({
  block,
  index,
  selectedId,
  invalidIds,
  readOnly,
  onSelect,
  onToggleHidden,
  onRemove,
}: Omit<Props, "doc" | "onMove"> & { block: DraftBlock; index: number }) {
  const def = BLOCK_BY_TYPE[block.type]
  const Icon = BLOCK_ICONS[def.icon]
  const selected = block.id === selectedId
  const joined = block.joinPrevious && index > 0
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled: readOnly })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-selected={selected || undefined}
      className={cn(
        "group/item relative flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 transition-[border-color,box-shadow]",
        "hover:border-primary/40",
        selected && "border-primary shadow-[0_0_0_1px_var(--primary)]",
        isDragging && "z-10 shadow-lg",
        joined &&
          "xl:before:absolute xl:before:-top-2.5 xl:before:left-[2.85rem] xl:before:h-2.5 xl:before:w-0.5 xl:before:rounded-full xl:before:bg-primary/50"
      )}
    >
      {readOnly ? (
        <span aria-hidden className="w-1" />
      ) : (
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Reorder ${def.label}`}
          className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVerticalIcon aria-hidden className="size-4" />
        </button>
      )}
      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 pr-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          block.hidden && "opacity-55"
        )}
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(block.id)}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors",
            selected && "bg-accent text-accent-foreground"
          )}
        >
          {Icon ? <Icon className="size-3.5" /> : null}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 text-sm leading-tight font-semibold">
            {def.label}
          </span>
          <span className="flex items-center gap-1 truncate font-mono text-[11px] text-muted-foreground">
            #{block.anchor}
            {joined ? (
              <>
                <Link2Icon aria-hidden className="size-3" />
                <span className="font-sans">same card</span>
              </>
            ) : null}
            {block.hidden ? <span className="font-sans">· hidden</span> : null}
          </span>
        </span>
      </button>
      {invalidIds.has(block.id) ? (
        <StatusPill tone="danger" className="h-6 px-2">
          Fix
        </StatusPill>
      ) : null}
      {readOnly ? null : (
        <span className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              block.hidden ? `Show ${def.label}` : `Hide ${def.label}`
            }
            className="text-muted-foreground"
            onClick={() => onToggleHidden(block)}
          >
            {block.hidden ? (
              <EyeOffIcon aria-hidden />
            ) : (
              <EyeIcon aria-hidden />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${def.label}`}
            className="hover:bg-danger-soft hover:text-danger text-muted-foreground"
            onClick={() => onRemove(block.id)}
          >
            <TrashIcon aria-hidden />
          </Button>
        </span>
      )}
    </li>
  )
}

"use client"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { GripVerticalIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { usePermission } from "@/admin/lib/actor-context"
import { relativeTime } from "@/admin/components/dashboard/format"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { BOARD_STATUSES, type LeadStatus } from "@/lib/leads/schema"
import { cn } from "@/lib/utils"

import { statusLabel, topicLabel } from "./present"
import type { LeadRow } from "./queries"
import { useUpdateLead } from "./use-update-lead"

type BoardStatus = (typeof BOARD_STATUSES)[number]

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("")

function Card({
  lead,
  now,
  canMove,
  onOpen,
}: {
  lead: LeadRow
  now: number
  canMove: boolean
  onOpen(id: string): void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: lead.id, disabled: !canMove })
  return (
    <li
      ref={setNodeRef}
      {...(canMove ? listeners : {})}
      className={cn(
        "flex items-start gap-2 rounded-xl bg-card p-3 shadow-xs",
        isDragging && "opacity-50"
      )}
    >
      {canMove ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          aria-label={`Move ${lead.name}`}
          className="mt-0.5 touch-none rounded-md text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <GripVerticalIcon className="size-4" aria-hidden />
        </button>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button
          type="button"
          onClick={() => onOpen(lead.id)}
          className="text-left text-sm font-semibold outline-none focus-visible:underline"
        >
          {lead.name}
        </button>
        <p className="truncate text-xs text-muted-foreground">
          {topicLabel(lead.topicSlug)}
        </p>
        <p className="text-xs text-muted-foreground">
          {relativeTime(lead.createdAt, now)}
        </p>
      </div>
      {lead.assignee ? (
        <Avatar size="sm" title={lead.assignee.name}>
          <AvatarFallback aria-label={`Assigned to ${lead.assignee.name}`}>
            {initials(lead.assignee.name)}
          </AvatarFallback>
        </Avatar>
      ) : null}
    </li>
  )
}

function Column({
  status,
  leads,
  total,
  now,
  canMove,
  onOpen,
}: {
  status: BoardStatus
  leads: LeadRow[]
  total: number | undefined
  now: number
  canMove: boolean
  onOpen(id: string): void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const heading = `${status}-heading`
  return (
    <div
      className={cn(
        "rounded-card flex min-h-40 flex-col gap-3 bg-muted/50 p-3",
        isOver && "ring-2 ring-primary"
      )}
    >
      <h2
        id={heading}
        className="flex items-center justify-between text-sm font-semibold"
      >
        <span>{statusLabel(status)}</span>
        <span className="text-muted-foreground tabular-nums">
          {total ?? leads.length}
        </span>
      </h2>
      <ul
        ref={setNodeRef}
        role="list"
        aria-label={statusLabel(status)}
        className="flex flex-1 flex-col gap-2"
      >
        {leads.map((lead) => (
          <Card
            key={lead.id}
            lead={lead}
            now={now}
            canMove={canMove}
            onOpen={onOpen}
          />
        ))}
      </ul>
      {total !== undefined && total > leads.length ? (
        <p className="text-xs text-muted-foreground">
          Showing {leads.length} of {total} ·{" "}
          <Link
            className="underline"
            href={`/admin/leads?view=table&status=${status}`}
          >
            open table view
          </Link>
        </p>
      ) : null}
    </div>
  )
}

// Four status columns. Dragging a card PATCHes its status; the drawer's
// status Select is the non-drag way (WCAG 2.5.7).
export function LeadsBoard({
  leads,
  totals,
  onOpen,
}: {
  leads: LeadRow[]
  totals: Partial<Record<BoardStatus, number>>
  onOpen(id: string): void
}) {
  const update = useUpdateLead()
  const canMove = usePermission({ lead: ["update"] })
  const [now] = useState(Date.now)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const to = over?.id as LeadStatus | undefined
    const lead = leads.find((l) => l.id === active.id)
    if (!canMove || !lead || !to || to === lead.status) return
    if (!(BOARD_STATUSES as readonly string[]).includes(to)) return
    update.mutate({ id: lead.id, patch: { status: to } })
  }
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BOARD_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            leads={leads.filter((l) => l.status === status)}
            total={totals[status]}
            now={now}
            canMove={canMove}
            onOpen={onOpen}
          />
        ))}
      </div>
    </DndContext>
  )
}

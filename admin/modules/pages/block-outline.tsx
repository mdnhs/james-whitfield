"use client"

import { Link2Icon } from "lucide-react"

import { StatusPill } from "@/admin/components/dashboard/status-pill"
import type { DraftBlock } from "@/blocks/page"
import { BLOCK_BY_TYPE } from "@/blocks/registry"
import { cn } from "@/lib/utils"

import { BLOCK_ICONS } from "./block-icons"

type Props = {
  blocks: readonly DraftBlock[]
  selectedId: string | null
  invalidIds?: ReadonlySet<string>
  readOnly: boolean
  onSelect(id: string): void
}

// The page's sections are fixed: the outline only picks which one to edit,
// and hidden sections are not offered.
export function BlockOutline({
  blocks,
  selectedId,
  invalidIds,
  onSelect,
}: Props) {
  return (
    <ol
      aria-label="Blocks"
      className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"
    >
      {blocks.map((block, index) =>
        block.hidden ? null : (
          <OutlineItem
            key={block.id}
            block={block}
            joined={block.joinPrevious && index > 0}
            selected={block.id === selectedId}
            invalid={invalidIds?.has(block.id) ?? false}
            onSelect={onSelect}
          />
        )
      )}
    </ol>
  )
}

function OutlineItem({
  block,
  joined,
  selected,
  invalid,
  onSelect,
}: {
  block: DraftBlock
  joined: boolean
  selected: boolean
  invalid: boolean
  onSelect(id: string): void
}) {
  const def = BLOCK_BY_TYPE[block.type]
  const Icon = BLOCK_ICONS[def.icon]
  return (
    <li
      data-selected={selected || undefined}
      className={cn(
        "group/item relative flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 transition-[border-color,box-shadow]",
        "hover:border-primary/40",
        selected && "border-primary shadow-[0_0_0_1px_var(--primary)]",
        joined &&
          "xl:before:absolute xl:before:-top-2.5 xl:before:left-5 xl:before:h-2.5 xl:before:w-0.5 xl:before:rounded-full xl:before:bg-primary/50"
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
          <span className="flex min-w-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
            <span className="truncate" title={`#${block.anchor}`}>
              #{block.anchor}
            </span>
            {joined ? (
              <>
                <Link2Icon aria-hidden className="size-3" />
                <span className="font-sans">same card</span>
              </>
            ) : null}
          </span>
        </span>
      </button>
      {invalid ? (
        <StatusPill tone="danger" className="h-6 px-2">
          Fix
        </StatusPill>
      ) : null}
    </li>
  )
}

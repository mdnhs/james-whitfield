"use client"

import type { PageKind } from "@/blocks/define-block"
import type { DraftDocument } from "@/blocks/page"
import { BLOCK_BY_TYPE, type BlockType } from "@/blocks/registry"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { BLOCK_ICONS } from "./block-icons"
import { addableTypes } from "./builder-state"

export function BlockLibrary({
  open,
  onOpenChange,
  kind,
  doc,
  onAdd,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  kind: PageKind
  doc: DraftDocument
  onAdd(type: BlockType): void
}) {
  const types = addableTypes(kind, doc)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 p-5 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Add a block
          </DialogTitle>
          <DialogDescription>
            Only blocks this page can publish are listed.
          </DialogDescription>
        </DialogHeader>
        {types.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
            This page already has every block it can hold.
          </p>
        ) : (
          <ul className="grid max-h-[60vh] gap-2.5 overflow-y-auto p-0.5 sm:grid-cols-2 md:grid-cols-3">
            {types.map((type) => {
              const def = BLOCK_BY_TYPE[type]
              const Icon = BLOCK_ICONS[def.icon]
              return (
                <li key={type}>
                  <button
                    type="button"
                    className="group/tile flex h-full w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors outline-none hover:border-primary hover:bg-accent/40 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    onClick={() => {
                      onAdd(type)
                      onOpenChange(false)
                    }}
                  >
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover/tile:bg-primary group-hover/tile:text-primary-foreground"
                    >
                      {Icon ? <Icon className="size-5" /> : null}
                    </span>
                    <span className="text-sm leading-tight font-semibold">
                      {def.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { TriangleAlertIcon } from "lucide-react"

import { FORM_ACTION } from "@/admin/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type { Conflict } from "./use-autosave"

const TIME = new Intl.DateTimeFormat("en-IE", {
  hour: "2-digit",
  minute: "2-digit",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Dublin",
})

// No onOpenChange and no close button: autosave stays stopped until the
// editor makes a choice (docs/brief.md §6.5, Review Focus 3).
export function ConflictDialog({
  conflict,
  onReview,
  onOverwrite,
}: {
  conflict: Conflict | null
  onReview(): void
  onOverwrite(): void
}) {
  const when = conflict?.updatedAt
    ? TIME.format(new Date(conflict.updatedAt))
    : "just now"
  return (
    <Dialog open={conflict !== null}>
      <DialogContent showCloseButton={false} className="gap-5 p-6 sm:max-w-md">
        <DialogHeader className="gap-3">
          <span
            aria-hidden
            className="bg-warning-soft text-warning flex size-11 items-center justify-center rounded-full"
          >
            <TriangleAlertIcon className="size-5" />
          </span>
          <DialogTitle className="text-lg font-semibold">
            Changed by someone else
          </DialogTitle>
          <DialogDescription className="text-[14px] leading-relaxed">
            {conflict?.updatedBy ?? "Someone"} saved this page at {when}. Review
            loads their version and drops your unsaved edits; Overwrite saves
            yours over theirs.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 rounded-b-xl border-t bg-muted/50 p-4 sm:justify-end">
          <Button variant="outline" className={FORM_ACTION} onClick={onReview}>
            Review changes
          </Button>
          <Button className={FORM_ACTION} onClick={onOverwrite}>
            Overwrite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

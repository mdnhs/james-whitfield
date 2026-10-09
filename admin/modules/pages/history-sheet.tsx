"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { HistoryIcon } from "lucide-react"
import { toast } from "sonner"

import { pagesApi, parseResponse } from "@/admin/lib/api"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

import { pageRevisionsQuery } from "./queries"
import { conflictOf, type Conflict } from "./use-autosave"

// Every publish is a revision (docs/brief.md §6.5). Loading one replaces
// the draft; publishing it is a separate, deliberate step.
export function HistorySheet({
  open,
  onOpenChange,
  pageId,
  getVersion,
  canRestore,
  onRestored,
  onConflict,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  pageId: string
  getVersion(): number
  canRestore: boolean
  onRestored(): void
  onConflict(conflict: Conflict): void
}) {
  const list = useQuery({ ...pageRevisionsQuery(pageId), enabled: open })
  const restore = useMutation({
    mutationFn: (rev: string) =>
      parseResponse(
        pagesApi[":id"].revisions[":rev"].restore.$post({
          param: { id: pageId, rev },
          json: { version: getVersion() },
        })
      ),
    onSuccess: () => {
      onOpenChange(false)
      toast.success("Loaded into the draft")
      onRestored()
    },
    onError: (error) => {
      const conflict = conflictOf(error)
      if (conflict) {
        onOpenChange(false)
        onConflict(conflict)
      } else toast.error(error.message)
    },
  })
  const items = list.data?.items ?? []
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="text-lg font-semibold">History</SheetTitle>
          <SheetDescription>
            Each publish is kept. Load one into the draft to bring it back.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5">
          {list.isPending ? (
            <div className="flex flex-col gap-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="bg-skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : list.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p>{list.error.message}</p>
              <Button variant="outline" onClick={() => void list.refetch()}>
                Try again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              <HistoryIcon aria-hidden className="size-6" />
              <p>Nothing published yet.</p>
            </div>
          ) : (
            <ol className="relative flex flex-col gap-3 before:absolute before:top-4 before:bottom-4 before:left-[15px] before:w-px before:bg-border">
              {items.map((item, index) => (
                <li key={item.id} className="relative flex gap-3">
                  <span
                    aria-hidden
                    className={
                      index === 0
                        ? "z-10 mt-3 size-[9px] shrink-0 translate-x-[11px] rounded-full bg-primary ring-4 ring-popover"
                        : "z-10 mt-3 size-[9px] shrink-0 translate-x-[11px] rounded-full bg-muted-foreground/50 ring-4 ring-popover"
                    }
                  />
                  <div className="ml-4 flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
                    <p className="min-w-0 text-sm">
                      <span className="font-semibold">
                        Version {item.version}
                      </span>
                      <span className="text-muted-foreground">
                        {" · "}
                        {item.createdBy ?? "Someone"}
                        {" · "}
                        {formatDistanceToNow(new Date(item.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </p>
                    {canRestore ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={restore.isPending}
                        onClick={() => restore.mutate(item.id)}
                      >
                        {restore.isPending && restore.variables === item.id ? (
                          <Spinner data-icon="inline-start" />
                        ) : null}
                        Load into draft
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

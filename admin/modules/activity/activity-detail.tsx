"use client"

import { useQuery } from "@tanstack/react-query"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { diffRows } from "@/lib/audit/diff"

import { auditDetailQuery } from "./queries"

export function ActivityDetail({
  id,
  onClose,
}: {
  id: string | null
  onClose: () => void
}) {
  const detail = useQuery({
    ...auditDetailQuery(id ?? ""),
    enabled: id !== null,
  })
  const rows = diffRows(detail.data?.diff ?? null)
  return (
    <Sheet
      open={id !== null}
      onOpenChange={(open) => (open ? null : onClose())}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{detail.data?.summary ?? "Activity"}</SheetTitle>
          <SheetDescription>
            {detail.data ? (
              <>
                <code className="font-mono">{detail.data.action}</code> ·{" "}
                {detail.data.entityType}
                {detail.data.entityId ? ` ${detail.data.entityId}` : ""}
                {detail.data.impersonatorName
                  ? ` · by ${detail.data.impersonatorName}, viewing as ${detail.data.actorName ?? detail.data.actorEmail}`
                  : ""}
              </>
            ) : (
              "Loading the details."
            )}
          </SheetDescription>
        </SheetHeader>
        {detail.isPending ? null : detail.isError ? (
          <p role="alert" className="px-4 text-sm text-destructive">
            {detail.error.message}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No field changes were recorded for this entry.
          </p>
        ) : (
          <dl className="flex flex-col gap-4 px-4 pb-6">
            {rows.map((row) => (
              <div key={row.field} className="flex flex-col gap-1">
                <dt className="font-mono text-xs font-semibold">{row.field}</dt>
                <dd className="grid gap-2 sm:grid-cols-2">
                  <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">
                    <span className="sr-only">Before: </span>
                    {row.from}
                  </pre>
                  <pre className="overflow-x-auto rounded-md bg-primary/10 p-2 text-xs whitespace-pre-wrap">
                    <span className="sr-only">After: </span>
                    {row.to}
                  </pre>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </SheetContent>
    </Sheet>
  )
}

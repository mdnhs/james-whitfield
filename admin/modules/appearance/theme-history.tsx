"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"

import { themeRevisionsQuery } from "./queries"

export function ThemeHistory({
  canRestore,
  onLoad,
}: {
  canRestore: boolean
  onLoad(revisionId: string): void
}) {
  const revisions = useQuery(themeRevisionsQuery())
  return (
    <section
      aria-label="Published versions"
      className="rounded-card flex flex-col gap-3 bg-card p-5"
    >
      <h2 className="text-card-title">History</h2>
      {revisions.data?.length ? (
        <ul className="flex flex-col divide-y">
          {revisions.data.map((rev) => (
            <li
              key={rev.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="flex flex-col">
                <span className="font-medium">
                  {format(new Date(rev.createdAt), "d MMM yyyy, HH:mm")}
                </span>
                <span className="text-muted-foreground">
                  {rev.createdBy ?? "Unknown"}
                  {rev.note ? ` · ${rev.note}` : ""}
                </span>
              </span>
              {canRestore ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onLoad(rev.id)}
                >
                  Load into draft
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {revisions.isPending ? "Loading…" : "Nothing published yet."}
        </p>
      )}
    </section>
  )
}

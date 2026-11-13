"use client"

import { useMutation } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import {
  DeleteIconButton,
  EditIconButton,
} from "@/admin/components/actions/icon-actions"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { usePermission } from "@/admin/lib/actor-context"
import { pagesApi, parseResponse } from "@/admin/lib/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"

export type LegalPageRow = {
  id: string
  title: string
  path: string
  status: "draft" | "published"
  version: number
}

// The same row actions as Services and Insights: a switch for whether the
// page is live, then Edit and Delete as icons. The list is rendered on the
// server, so every change refreshes the route.
function LegalPageActions({ page }: { page: LegalPageRow }) {
  const router = useRouter()
  const canPublish = usePermission({ page: ["publish"] })
  const canDelete = usePermission({ page: ["delete"] })
  const [removing, setRemoving] = useState(false)
  const title = page.title || page.path

  const live = useMutation({
    mutationFn: async (next: boolean) => {
      const args = { param: { id: page.id }, json: { version: page.version } }
      if (next) await parseResponse(pagesApi[":id"].publish.$post(args))
      else await parseResponse(pagesApi[":id"].unpublish.$post(args))
    },
    onSuccess: (_, next) => {
      toast.success(next ? `Published ${title}` : `Unpublished ${title}`)
      router.refresh()
    },
    onError: (error) => {
      toast.error(error.message)
      router.refresh()
    },
  })

  const remove = useMutation({
    mutationFn: () =>
      parseResponse(pagesApi[":id"].$delete({ param: { id: page.id } })),
    onSuccess: () => {
      toast.success(`Deleted ${title}`)
      setRemoving(false)
      router.refresh()
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <div className="flex items-center gap-1">
      {/* The switch alone says whether it is live; no label. */}
      <Switch
        aria-label={`Publish ${title}`}
        checked={page.status === "published"}
        disabled={!canPublish || live.isPending}
        onCheckedChange={(next) => live.mutate(next)}
        className="mr-1"
      />
      <EditIconButton
        label={`Edit ${title}`}
        onClick={() => router.push(`/admin/pages/${page.id}`)}
      />
      {canDelete ? (
        <DeleteIconButton
          label={`Delete ${title}`}
          onClick={() => setRemoving(true)}
        />
      ) : null}
      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader className="gap-3">
            <DialogTitle className="text-lg font-semibold">
              {`Delete ${title}?`}
            </DialogTitle>
            <DialogDescription>
              {page.status === "published"
                ? `It is live at ${page.path} now. Deleting it removes the page and its history; links to it will stop working. This can't be undone.`
                : "This removes the page and its history. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {remove.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" />
              )}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function LegalPagesList({ pages }: { pages: LegalPageRow[] }) {
  if (pages.length === 0) {
    return <p className="text-sm text-muted-foreground">No legal pages yet.</p>
  }
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {pages.map((page) => (
        <li
          key={page.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="flex min-w-0 flex-col">
            <Link
              href={`/admin/pages/${page.id}`}
              className="font-semibold underline-offset-4 hover:text-primary hover:underline"
            >
              {page.title}
            </Link>
            <code className="font-mono text-xs text-muted-foreground">
              {page.path}
            </code>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill
              tone={page.status === "published" ? "success" : "neutral"}
            >
              {page.status === "published" ? "Published" : "Draft"}
            </StatusPill>
            <LegalPageActions page={page} />
          </div>
        </li>
      ))}
    </ul>
  )
}

"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { usePermission } from "@/admin/lib/actor-context"
import { parseResponse, servicePagesApi } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { collectionListQuery } from "@/admin/modules/collections/queries"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

// Turning a service's details page on creates it; turning it off deletes it.
export function ServicesPanel() {
  const queryClient = useQueryClient()
  const list = useQuery(collectionListQuery("services"))
  const canCreate = usePermission({ collection: ["create"] })
  const canDelete = usePermission({ collection: ["delete"] })
  const canEditPage = usePermission({ page: ["update"] })
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<{
    id: string
    title: string
  } | null>(null)

  const items = list.data?.items ?? []

  function setBusyFor(id: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function run(id: string, action: () => Promise<unknown>, fail: string) {
    setBusyFor(id, true)
    try {
      await action()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fail)
    } finally {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.collections.list("services"),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pages.list }),
      ])
      setBusyFor(id, false)
    }
  }

  const enable = (id: string) =>
    run(
      id,
      () =>
        parseResponse(
          servicePagesApi[":serviceId"].$post({ param: { serviceId: id } })
        ),
      "Couldn't create the details page"
    )

  async function confirmDelete() {
    if (!deleting) return
    const { id } = deleting
    setDeleting(null)
    await run(
      id,
      () =>
        parseResponse(
          servicePagesApi[":serviceId"].$delete({ param: { serviceId: id } })
        ),
      "Couldn't delete the details page"
    )
  }

  return (
    <section
      aria-labelledby="service-pages-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="service-pages-heading" className="text-lg font-semibold">
        Service details pages
      </h2>
      {list.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const page = "detailPage" in item ? item.detailPage : null
            const on = page != null
            return (
              <li
                key={item.id}
                className="rounded-card flex flex-wrap items-center gap-3 bg-card p-3"
              >
                <p className="min-w-0 flex-1 font-semibold break-words">
                  {item.title}
                </p>
                {page ? (
                  <StatusPill
                    tone={page.status === "published" ? "success" : "neutral"}
                  >
                    {page.status === "published" ? "Published" : "Draft"}
                  </StatusPill>
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  Details page
                  <Switch
                    aria-label={`Details page for ${item.title}`}
                    checked={on}
                    disabled={
                      busy.has(item.id) || (on ? !canDelete : !canCreate)
                    }
                    onCheckedChange={(next) =>
                      next
                        ? void enable(item.id)
                        : setDeleting({ id: item.id, title: item.title })
                    }
                  />
                </label>
                {page && canEditPage ? (
                  <Link
                    href={`/admin/pages/${page.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Edit page
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => !next && setDeleting(null)}
      >
        <DialogContent className="gap-5 p-6 sm:max-w-md">
          <DialogHeader className="gap-3">
            <DialogTitle className="text-lg font-semibold">
              Delete details page?
            </DialogTitle>
            <DialogDescription>
              {`Delete the details page for ${deleting?.title ?? ""}? Its content can't be recovered.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-6 -mb-6 rounded-b-xl border-t bg-muted/50 p-4 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              Delete page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

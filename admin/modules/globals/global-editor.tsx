"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { formatDistanceToNow } from "date-fns"
import { HistoryIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { PageHeader } from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { usePermission } from "@/admin/lib/actor-context"
import { globalsApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { conflictOf } from "@/admin/modules/pages/use-autosave"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  GLOBAL_ACCESS,
  GLOBAL_LABELS,
  type EditableGlobalKey,
} from "@/lib/content/global-access"
import { GLOBALS } from "@/lib/content/globals"

import { GLOBAL_FIELD_UI } from "./global-ui"
import { globalQuery, globalRevisionsQuery } from "./queries"

export function GlobalEditor({
  title,
  keys,
  onValuesChange,
}: {
  title: string
  keys: readonly EditableGlobalKey[]
  // Single-key editors only: live values for previews.
  onValuesChange?: (values: unknown) => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description="Changes go live as soon as you save."
      />
      {keys.length === 1 ? (
        <GlobalForm settingKey={keys[0]!} onValuesChange={onValuesChange} />
      ) : (
        <Tabs defaultValue={keys[0]}>
          <TabsList className="h-auto flex-wrap">
            {keys.map((key) => (
              <TabsTrigger key={key} value={key} className="px-3 py-1.5">
                {GLOBAL_LABELS[key]}
              </TabsTrigger>
            ))}
          </TabsList>
          {keys.map((key) => (
            <TabsContent key={key} value={key} className="pt-2">
              <GlobalForm settingKey={key} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

// Globals go live on save (docs/brief.md §6.5), guarded by version; keyed by
// version so a save, a restore or a reload shows the stored values.
function GlobalForm({
  settingKey,
  onValuesChange,
}: {
  settingKey: EditableGlobalKey
  onValuesChange?: (values: unknown) => void
}) {
  const queryClient = useQueryClient()
  const doc = useQuery(globalQuery(settingKey))
  const canUpdate = usePermission(GLOBAL_ACCESS[settingKey].update)
  const [historyOpen, setHistoryOpen] = useState(false)
  const label = GLOBAL_LABELS[settingKey]
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.globals.detail(settingKey),
    })
  if (doc.isError)
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{doc.error.message}</p>
        <Button variant="outline" onClick={() => void doc.refetch()}>
          Try again
        </Button>
      </div>
    )
  if (!doc.data) return <CardSkeleton />
  const { version, value } = doc.data
  return (
    <section aria-label={label} className="flex flex-col gap-4">
      <Button
        variant="outline"
        className="self-end"
        onClick={() => setHistoryOpen(true)}
      >
        <HistoryIcon data-icon="inline-start" />
        History
      </Button>
      <fieldset disabled={!canUpdate} className="min-w-0">
        <SchemaForm
          key={version}
          schema={GLOBALS[settingKey]}
          overrides={GLOBAL_FIELD_UI[settingKey]}
          defaultValues={value as never}
          submitLabel={`Save ${label.toLowerCase()}`}
          onValuesChange={onValuesChange}
          onSubmit={async (next) => {
            try {
              await parseResponse(
                globalsApi[":key"].$put({
                  param: { key: settingKey },
                  json: { version, value: next },
                })
              )
              toast.success(`${label} saved`)
              await refresh()
            } catch (error) {
              if (conflictOf(error)) {
                await refresh()
                return {
                  formError:
                    "Someone else saved this a moment ago. Their version is loaded; make your change again.",
                }
              }
              if (error instanceof ApiError)
                return {
                  formError: error.message,
                  fieldErrors: error.fieldErrors,
                }
              throw error
            }
          }}
        />
      </fieldset>
      <GlobalHistory
        settingKey={settingKey}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        version={version}
        canRestore={canUpdate}
        onRestored={refresh}
      />
    </section>
  )
}

// Each save is a revision (20 kept). Restoring saves it as the newest version.
function GlobalHistory({
  settingKey,
  open,
  onOpenChange,
  version,
  canRestore,
  onRestored,
}: {
  settingKey: EditableGlobalKey
  open: boolean
  onOpenChange(open: boolean): void
  version: number
  canRestore: boolean
  onRestored(): unknown
}) {
  const list = useQuery({ ...globalRevisionsQuery(settingKey), enabled: open })
  const queryClient = useQueryClient()
  const restore = useMutation({
    mutationFn: (rev: string) =>
      parseResponse(
        globalsApi[":key"].revisions[":rev"].restore.$post({
          param: { key: settingKey, rev },
          json: { version },
        })
      ),
    onSuccess: async () => {
      toast.success("Restored")
      onOpenChange(false)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.globals.revisions(settingKey),
      })
      await onRestored()
    },
    onError: async (error) => {
      toast.error(error.message)
      if (conflictOf(error)) await onRestored()
    },
  })
  const items = list.data?.items ?? []
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="text-lg font-semibold">
            {GLOBAL_LABELS[settingKey]} history
          </SheetTitle>
          <SheetDescription>
            Every save is kept (the latest 20). Pick one to bring it back.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5">
          {list.isPending ? (
            <div className="flex flex-col gap-3" aria-hidden>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="bg-skeleton h-14 rounded-xl" />
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
            <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
              Nothing saved yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3"
                >
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
                      Restore
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

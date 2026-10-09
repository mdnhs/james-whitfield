"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  EyeIcon,
  HistoryIcon,
  LayersIcon,
  LockIcon,
  PlusIcon,
  RotateCwIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import {
  FORM_ACTION,
  PageHeader,
  PRIMARY_ACTION,
  SECONDARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { StatusPill } from "@/admin/components/dashboard/status-pill"
import { usePermission } from "@/admin/lib/actor-context"
import { pagesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { DraftDocument, type DraftBlock } from "@/blocks/page"
import { BLOCK_BY_TYPE } from "@/blocks/registry"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { BlockForm } from "./block-form"
import { BLOCK_ICONS } from "./block-icons"
import { BlockLibrary } from "./block-library"
import { BlockMeta } from "./block-meta"
import { BlockOutline } from "./block-outline"
import { docReducer, errorsByBlock, type DocAction } from "./builder-state"
import { ConflictDialog } from "./conflict-dialog"
import { HistorySheet } from "./history-sheet"
import { PreviewPane, previewSrc } from "./preview-pane"
import { pageDetailQuery, type PageDetail } from "./queries"
import { SaveIndicator } from "./save-indicator"
import { SeoForm } from "./seo-form"
import { conflictOf, useAutosave, type Conflict } from "./use-autosave"

export function PageBuilder({ id }: { id: string }) {
  const query = useQuery(pageDetailQuery(id))
  // Review / restore / discard load the server copy into a fresh builder.
  const [generation, setGeneration] = useState(0)
  const { refetch } = query
  const reload = useCallback(async () => {
    await refetch()
    setGeneration((g) => g + 1)
  }, [refetch])
  // Only a copy fetched for this mount: a cached one may be versions old.
  if (query.isPending || (query.isSuccess && !query.isFetchedAfterMount))
    return <BuilderSkeleton />
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{query.error.message}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  return <Builder key={generation} page={query.data} reload={reload} />
}

function BuilderSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <CardSkeleton className="h-24" />
      <div className="grid gap-5 xl:grid-cols-[272px_minmax(0,1fr)_minmax(0,1.1fr)]">
        <CardSkeleton className="h-96" />
        <CardSkeleton className="h-96" />
        <CardSkeleton className="h-96" />
      </div>
    </div>
  )
}

const toDraft = (value: unknown): DraftDocument => {
  const parsed = DraftDocument.safeParse(value)
  return parsed.success ? parsed.data : { blocks: [] }
}

function Builder({
  page,
  reload,
}: {
  page: PageDetail
  reload(): Promise<void>
}) {
  const queryClient = useQueryClient()
  const canEdit = usePermission({ page: ["update"] })
  const canPublish = usePermission({ page: ["publish"] })
  const readOnly = !canEdit
  const [doc, setDoc] = useState(() => toDraft(page.draft))
  const docRef = useRef(doc)
  const [selectedId, setSelectedId] = useState<string | null>(
    doc.blocks[0]?.id ?? null
  )
  // Keyed by block id when publish fails, so a later reorder cannot move
  // the markers; a block's own edit clears them.
  const [blockErrors, setBlockErrors] = useState<
    ReadonlyMap<string, Record<string, string[]>>
  >(() => new Map())
  // A publish, discard or restore found a newer version on the server.
  const [stale, setStale] = useState<Conflict | null>(null)
  const [dismissed, setDismissed] = useState<Conflict | null>(null)
  const [unpublished, setUnpublished] = useState(page.hasUnpublishedChanges)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const { state, schedule, flush, exclusive, overwrite, reset, getVersion } =
    useAutosave<DraftDocument>({
      version: page.version,
      save: async (document, version, options) => {
        const result = await parseResponse(
          pagesApi[":id"].draft.$patch(
            { param: { id: page.id }, json: { version, document } },
            options?.keepalive ? { init: { keepalive: true } } : undefined
          )
        )
        syncCache({
          // The column holds any draft; its type is the published shape.
          draft: document as unknown as PageDetail["draft"],
          version: result.version,
          updatedAt: result.updatedAt,
          hasUnpublishedChanges: true,
        })
        return result
      },
    })

  // The detail cache follows every write, so it never holds a version
  // older than the server's.
  function syncCache(patch: Partial<PageDetail>) {
    queryClient.setQueryData(
      queryKeys.pages.detail(page.id),
      (old: PageDetail | undefined) => (old ? { ...old, ...patch } : old)
    )
  }

  // A read-only actor can look around; nothing they touch is sent.
  const apply = useCallback(
    (action: DocAction) => {
      if (readOnly) return docRef.current
      const next = docReducer(docRef.current, action)
      if ("id" in action)
        setBlockErrors((errors) => {
          if (!errors.has(action.id)) return errors
          const rest = new Map(errors)
          rest.delete(action.id)
          return rest
        })
      docRef.current = next
      setDoc(next)
      setUnpublished(true)
      schedule(next)
      return next
    },
    [readOnly, schedule]
  )

  // Review, restore and discard replace the working copy with the server's:
  // drop what is queued so the old builder sends nothing as it unmounts.
  const replaceWithServer = useCallback(() => {
    reset(getVersion())
    setStale(null)
    void reload()
  }, [getVersion, reload, reset])

  const selected = doc.blocks.find((block) => block.id === selectedId) ?? null
  const invalidIds = useMemo(() => new Set(blockErrors.keys()), [blockErrors])
  const onData = useCallback(
    (data: Record<string, unknown>) => {
      if (selectedId) apply({ type: "data", id: selectedId, data })
    },
    [apply, selectedId]
  )

  // ⌘S / Ctrl+S saves now (a modifier shortcut, not a single-key hotkey).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void flush()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [flush])

  // A 409 here is not an autosave conflict (nothing of ours is unsaved):
  // the server simply has a newer version, so offer to load it.
  const handleError = (error: Error) => {
    const conflict = conflictOf(error)
    if (conflict) return setStale(conflict)
    if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
      const errors = errorsByBlock(error.fieldErrors, docRef.current)
      setBlockErrors(errors)
      const [first] = errors.keys()
      if (first) setSelectedId(first)
    }
    toast.error(error.message)
  }

  const publish = useMutation({
    // exclusive(): what is typed first is saved first, and edits made while
    // publishing wait for its version.
    mutationFn: () =>
      exclusive((version) =>
        parseResponse(
          pagesApi[":id"].publish.$post({
            param: { id: page.id },
            json: { version },
          })
        )
      ),
    onSuccess: (result) => {
      syncCache({
        version: result.version,
        status: "published",
        publishedAt: result.publishedAt,
        hasUnpublishedChanges: false,
      })
      setBlockErrors(new Map())
      setUnpublished(false)
      toast.success("Published")
      void queryClient.invalidateQueries({ queryKey: queryKeys.pages.all })
    },
    onError: handleError,
  })

  const discard = useMutation({
    mutationFn: () =>
      exclusive((version) =>
        parseResponse(
          pagesApi[":id"].discard.$post({
            param: { id: page.id },
            json: { version },
          })
        )
      ),
    onSuccess: () => {
      toast.success("Draft discarded")
      void queryClient.invalidateQueries({ queryKey: queryKeys.pages.list })
      replaceWithServer()
    },
    onError: handleError,
  })

  const published = page.status === "published"
  // Dismissing keeps autosave paused; the indicator reopens the choice.
  const conflictOpen =
    state.status === "conflict" &&
    state.conflict !== null &&
    state.conflict !== dismissed
  const SelectedIcon = selected
    ? BLOCK_ICONS[BLOCK_BY_TYPE[selected.type].icon]
    : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <Link
            href="/admin/pages"
            className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            Pages
          </Link>
        }
        title={page.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-card px-2 py-1 font-mono text-xs text-foreground">
              {page.path}
            </code>
            <StatusPill tone={published ? "success" : "neutral"}>
              {published ? "Published" : "Draft"}
            </StatusPill>
            {published && unpublished ? (
              <StatusPill tone="warning">Unpublished changes</StatusPill>
            ) : null}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {readOnly ? null : (
              <SaveIndicator
                state={state}
                onResolve={
                  state.status === "conflict" && !conflictOpen
                    ? () => setDismissed(null)
                    : undefined
                }
              />
            )}
            <Button
              variant="outline"
              className={cn(FORM_ACTION, "h-12 bg-card")}
              onClick={() => setHistoryOpen(true)}
            >
              <HistoryIcon data-icon="inline-start" />
              History
            </Button>
            <a
              href={previewSrc(page.path)}
              target="_blank"
              rel="noopener"
              className={cn(
                "inline-flex h-12 items-center gap-2 rounded-xl border bg-card px-5 text-[15px] font-semibold transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
              )}
            >
              <EyeIcon aria-hidden className="size-4" />
              Preview
            </a>
            {canEdit && published ? (
              <Button
                variant="outline"
                className={SECONDARY_ACTION}
                disabled={discard.isPending || !unpublished}
                onClick={() =>
                  window.confirm("Throw away every unpublished change?") &&
                  discard.mutate()
                }
              >
                Discard
              </Button>
            ) : null}
            {canPublish ? (
              <Button
                className={PRIMARY_ACTION}
                disabled={publish.isPending}
                onClick={() => publish.mutate()}
              >
                {publish.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : null}
                Publish
              </Button>
            ) : null}
          </div>
        }
      />
      {stale ? (
        <div
          role="alert"
          className="border-warning/40 bg-warning-soft flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm"
        >
          <TriangleAlertIcon
            aria-hidden
            className="text-warning size-4 shrink-0"
          />
          <p className="min-w-0 flex-1">
            <span className="font-semibold">This page changed.</span>{" "}
            {stale.updatedBy ?? "Someone"} saved a newer version, so that
            didn&apos;t go through. Load the latest version to carry on.
          </p>
          <Button size="sm" className="rounded-lg" onClick={replaceWithServer}>
            <RotateCwIcon data-icon="inline-start" />
            Reload latest
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Dismiss"
            onClick={() => setStale(null)}
          >
            <XIcon aria-hidden />
          </Button>
        </div>
      ) : null}
      {readOnly ? (
        <p
          role="note"
          className="flex items-start gap-3 rounded-2xl border border-dashed bg-card p-4 text-sm"
        >
          <LockIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <span>
            <span className="font-semibold">View only.</span>{" "}
            <span className="text-muted-foreground">
              Your role can read this page but not change or publish it. Ask an
              editor to make changes.
            </span>
          </span>
        </p>
      ) : null}
      <Tabs defaultValue="content" className="gap-5">
        <TabsList className="h-11 w-full rounded-xl bg-card p-1 sm:w-fit">
          <TabsTrigger value="content" className="rounded-lg px-5">
            Content
          </TabsTrigger>
          <TabsTrigger value="seo" className="rounded-lg px-5">
            SEO
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          <div className="grid items-start gap-5 xl:grid-cols-[272px_minmax(0,1fr)_minmax(0,1.1fr)]">
            <nav
              aria-label="Page outline"
              className="rounded-card flex flex-col gap-4 bg-card p-4 xl:sticky xl:top-4 xl:max-h-[calc(100svh-2rem)] xl:overflow-y-auto"
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <h2 className="text-card-title">Blocks</h2>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                  {doc.blocks.length}
                </span>
              </div>
              {doc.blocks.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No blocks yet.
                </p>
              ) : (
                <BlockOutline
                  doc={doc}
                  selectedId={selectedId}
                  invalidIds={invalidIds}
                  readOnly={readOnly}
                  onSelect={setSelectedId}
                  onMove={(from, to) => apply({ type: "move", from, to })}
                  onToggleHidden={(block: DraftBlock) =>
                    apply({
                      type: "meta",
                      id: block.id,
                      patch: { hidden: !block.hidden },
                    })
                  }
                  onRemove={(id) => {
                    if (window.confirm("Remove this block?"))
                      apply({ type: "remove", id })
                  }}
                />
              )}
              {canEdit ? (
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-dashed font-semibold text-primary hover:border-primary hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setLibraryOpen(true)}
                >
                  <PlusIcon data-icon="inline-start" />
                  Add block
                </Button>
              ) : null}
            </nav>
            <section
              aria-label="Block settings"
              className="rounded-card flex min-w-0 flex-col gap-6 bg-card p-5 sm:p-6"
            >
              {selected ? (
                <>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"
                    >
                      {SelectedIcon ? (
                        <SelectedIcon className="size-5" />
                      ) : null}
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-card-title truncate">
                        {BLOCK_BY_TYPE[selected.type].label}
                      </h2>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        #{selected.anchor}
                      </p>
                    </div>
                  </div>
                  <BlockForm
                    key={selected.id}
                    block={selected}
                    errors={blockErrors.get(selected.id)}
                    readOnly={readOnly}
                    onChange={onData}
                  />
                  <div className="flex flex-col gap-4 border-t pt-6">
                    <h3 className="text-[15px] font-semibold">
                      Section settings
                    </h3>
                    <BlockMeta
                      block={selected}
                      first={doc.blocks[0]?.id === selected.id}
                      errors={blockErrors.get(selected.id)}
                      readOnly={readOnly}
                      onChange={(patch) =>
                        apply({ type: "meta", id: selected.id, patch })
                      }
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                  <span
                    aria-hidden
                    className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground"
                  >
                    <LayersIcon className="size-6" />
                  </span>
                  <p className="font-semibold">
                    {doc.blocks.length === 0
                      ? "Start with a block"
                      : "Choose a block to edit it"}
                  </p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {doc.blocks.length === 0
                      ? "Pages are built from blocks: a hero, text, FAQs and more."
                      : "Pick one from the outline to change its content."}
                  </p>
                  {canEdit && doc.blocks.length === 0 ? (
                    <Button
                      className={FORM_ACTION}
                      onClick={() => setLibraryOpen(true)}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Add block
                    </Button>
                  ) : null}
                </div>
              )}
            </section>
            <PreviewPane
              path={page.path}
              refreshKey={state.savedAt}
              className="h-[75svh] xl:sticky xl:top-4 xl:h-[calc(100svh-2rem)]"
            />
          </div>
        </TabsContent>
        <TabsContent value="seo">
          <SeoForm
            page={page}
            onSaved={() =>
              void queryClient.invalidateQueries({
                queryKey: queryKeys.pages.all,
              })
            }
          />
        </TabsContent>
      </Tabs>
      <BlockLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        kind={page.kind}
        doc={doc}
        onAdd={(type) => {
          const before = new Set(docRef.current.blocks.map((b) => b.id))
          const next = apply({ type: "add", blockType: type })
          setSelectedId(next.blocks.find((b) => !before.has(b.id))?.id ?? null)
        }}
      />
      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        pageId={page.id}
        exclusive={exclusive}
        canRestore={canEdit}
        onRestored={replaceWithServer}
        onConflict={setStale}
      />
      <ConflictDialog
        conflict={conflictOpen ? state.conflict : null}
        onDismiss={() => setDismissed(state.conflict)}
        onReview={replaceWithServer}
        onOverwrite={() => void overwrite()}
      />
    </div>
  )
}

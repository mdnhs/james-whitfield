"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  EyeIcon,
  HistoryIcon,
  LockIcon,
  RotateCwIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
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
import { DraftDocument } from "@/blocks/page"
import { BLOCK_BY_TYPE } from "@/blocks/registry"
import { useEditorTab } from "@/admin/modules/seo/use-editor-tab"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { backLinkForPage } from "@/lib/admin/website"
import { cn } from "@/lib/utils"

import { AddressForm } from "./address-form"
import { BlockForm } from "./block-form"
import { BLOCK_ICONS } from "./block-icons"
import { BlockMeta } from "./block-meta"
import {
  docReducer,
  errorsByBlock,
  firstVisibleErrorBlock,
  publishProblems,
  type DocAction,
  type PublishProblem,
} from "./builder-state"
import { ConflictDialog } from "./conflict-dialog"
import { HistorySheet } from "./history-sheet"
import { PreviewPane, previewSrc } from "./preview-pane"
import { PublishProblems } from "./publish-problems"
import { pageDetailQuery, pageRevisionsQuery, type PageDetail } from "./queries"
import { SaveIndicator } from "./save-indicator"
import { SeoForm } from "./seo-form"
import { conflictOf, useAutosave, type Conflict } from "./use-autosave"

// The URL is the truth about which page is open (see ArticleEditorView).
export function PageBuilder({ id }: { id: string }) {
  const params = useParams<{ id?: string | string[] }>()
  const urlId = typeof params.id === "string" ? params.id : id
  return <PageLoader key={urlId} id={urlId} />
}

function PageLoader({ id }: { id: string }) {
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
  const [tab, setTab] = useEditorTab()
  const canEdit = usePermission({ page: ["update"] })
  const canPublish = usePermission({ page: ["publish"] })
  const readOnly = !canEdit
  const [doc, setDoc] = useState(() => toDraft(page.draft))
  const docRef = useRef(doc)
  // Keyed by block id when publish fails, so a later reorder cannot move
  // the markers; a block's own edit clears them.
  const [blockErrors, setBlockErrors] = useState<
    ReadonlyMap<string, Record<string, string[]>>
  >(() => new Map())
  // Every error the last failed publish reported, shown above the editor.
  const [problems, setProblems] = useState<PublishProblem[]>([])
  // A publish, discard or restore found a newer version on the server.
  const [stale, setStale] = useState<Conflict | null>(null)
  const [dismissed, setDismissed] = useState<Conflict | null>(null)
  const [unpublished, setUnpublished] = useState(page.hasUnpublishedChanges)
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

  // Sections are fixed: every visible one is edited in place, top to bottom.
  const visibleBlocks = useMemo(
    () => doc.blocks.filter((block) => !block.hidden),
    [doc.blocks]
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
      setProblems(publishProblems(error.fieldErrors, docRef.current))
      const first = firstVisibleErrorBlock(errors, docRef.current)
      if (first)
        document
          .getElementById(`block-${first}`)
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
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
      setProblems([])
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

  const back = backLinkForPage(page)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <Link
            href={back.href}
            className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            {back.label}
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
      <PublishProblems problems={problems} />
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
      <Tabs
        value={tab}
        onValueChange={(value) => void setTab(value as "content" | "seo")}
        className="gap-5"
      >
        <TabsList className="h-11 w-full rounded-xl bg-card p-1 sm:w-fit">
          <TabsTrigger value="content" className="rounded-lg px-5">
            Content
          </TabsTrigger>
          <TabsTrigger value="seo" className="rounded-lg px-5">
            SEO
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="flex min-w-0 flex-col gap-5">
              {visibleBlocks.map((block) => {
                const Icon = BLOCK_ICONS[BLOCK_BY_TYPE[block.type].icon]
                const label = BLOCK_BY_TYPE[block.type].label
                return (
                  <section
                    key={block.id}
                    id={`block-${block.id}`}
                    aria-labelledby={`block-${block.id}-title`}
                    data-block-card
                    data-invalid={blockErrors.has(block.id) || undefined}
                    className="rounded-card flex min-w-0 scroll-mt-4 flex-col gap-6 bg-card p-5 data-invalid:ring-2 data-invalid:ring-destructive/60 sm:p-6"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"
                      >
                        {Icon ? <Icon className="size-5" /> : null}
                      </span>
                      <div className="min-w-0">
                        <h2
                          id={`block-${block.id}-title`}
                          className="text-card-title truncate"
                        >
                          {label}
                        </h2>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          #{block.anchor}
                        </p>
                      </div>
                    </div>
                    <BlockForm
                      block={block}
                      errors={blockErrors.get(block.id)}
                      readOnly={readOnly}
                      pageTitle={page.title}
                      onChange={(data) =>
                        apply({ type: "data", id: block.id, data })
                      }
                    />
                    <div className="flex flex-col gap-4 border-t pt-6">
                      <h3 className="text-[15px] font-semibold">
                        Section settings
                      </h3>
                      <BlockMeta
                        block={block}
                        readOnly={readOnly}
                        onChange={(patch) =>
                          apply({ type: "meta", id: block.id, patch })
                        }
                      />
                    </div>
                  </section>
                )
              })}
            </div>
            <PreviewPane
              path={page.path}
              refreshKey={state.savedAt}
              className="h-[75svh] xl:sticky xl:top-4 xl:h-[calc(var(--content-h)-2rem)]"
            />
          </div>
        </TabsContent>
        <TabsContent value="seo" className="flex flex-col gap-6">
          <AddressForm page={page} onChanged={(path) => syncCache({ path })} />
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
      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        revisions={pageRevisionsQuery(page.id)}
        restore={(rev, version) =>
          parseResponse(
            pagesApi[":id"].revisions[":rev"].restore.$post({
              param: { id: page.id, rev },
              json: { version },
            })
          )
        }
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

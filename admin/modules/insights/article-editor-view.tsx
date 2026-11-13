"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CalendarXIcon,
  FileTextIcon,
  HistoryIcon,
  LockIcon,
  NewspaperIcon,
  RotateCwIcon,
  SearchCheckIcon,
  SendIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import {
  PageHeader,
  PRIMARY_ACTION,
} from "@/admin/components/dashboard/page-header"
import { TipButton } from "@/admin/components/actions/tip-button"
import { ArticleEditorSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { usePermission } from "@/admin/lib/actor-context"
import { articlesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { ConflictDialog } from "@/admin/modules/pages/conflict-dialog"
import { HistorySheet } from "@/admin/modules/pages/history-sheet"
import { SaveIndicator } from "@/admin/modules/pages/save-indicator"
import { useEditorTab } from "@/admin/modules/seo/use-editor-tab"
import {
  conflictOf,
  useAutosave,
  type Conflict,
} from "@/admin/modules/pages/use-autosave"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ArticleDraft } from "@/lib/content/article"

import { ArticleBodyEditor } from "./article-body-editor"
import { ArticleSeoForm } from "./article-seo-form"
import { ArticleSidebar, type FieldErrors } from "./article-sidebar"
import { ArticleStatus } from "./articles-view"
import { ScheduleDialog, UnpublishDialog } from "./publish-dialogs"
import {
  articleDetailQuery,
  articleRevisionsQuery,
  type ArticleDetail,
} from "./queries"

// History, Schedule and Unpublish as square icons beside Publish.
const HEADER_ICON = "size-12 rounded-xl bg-card"

const UNSCHEDULED_NOTICE =
  "Your edit moved this article back to draft; an editor must re-schedule it"

// The URL is the truth about which article is open: a reused router segment
// can carry another article's server-rendered id. Keyed on the URL id, so a
// different article is always a fresh editor (the old one flushes on unmount).
export function ArticleEditorView({ id }: { id: string }) {
  const params = useParams<{ id?: string | string[] }>()
  const urlId = typeof params.id === "string" ? params.id : id
  return <ArticleLoader key={urlId} id={urlId} />
}

function ArticleLoader({ id }: { id: string }) {
  const query = useQuery(articleDetailQuery(id))
  // Review / restore load the server copy into a fresh editor.
  const [generation, setGeneration] = useState(0)
  const { refetch } = query
  const reload = useCallback(async () => {
    await refetch()
    setGeneration((g) => g + 1)
  }, [refetch])
  // Only a copy fetched for this mount: a cached one may be versions old.
  if (query.isPending || (query.isSuccess && !query.isFetchedAfterMount))
    return <ArticleEditorSkeleton />
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
  return <Editor key={generation} article={query.data} reload={reload} />
}

function Editor({
  article,
  reload,
}: {
  article: ArticleDetail
  reload(): Promise<void>
}) {
  const queryClient = useQueryClient()
  const id = article.id
  const mayUpdate = usePermission({ article: ["update"] })
  const canEdit = article.canEdit && mayUpdate
  const canPublish = usePermission({ article: ["publish"] })
  const readOnly = !canEdit
  const [tab, setTab] = useEditorTab()
  const [draft, setDraft] = useState<ArticleDraft>(article.draft)
  const draftRef = useRef(draft)
  const [errors, setErrors] = useState<FieldErrors>({})
  // A publish, schedule or restore found a newer version on the server.
  const [stale, setStale] = useState<Conflict | null>(null)
  const [dismissed, setDismissed] = useState<Conflict | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [unpublishOpen, setUnpublishOpen] = useState(false)

  // The detail cache follows every write, so it never holds a version
  // older than the server's.
  function syncCache(patch: Partial<ArticleDetail>) {
    queryClient.setQueryData(
      queryKeys.articles.detail(id),
      (old: ArticleDetail | undefined) => (old ? { ...old, ...patch } : old)
    )
  }
  const refreshLists = () =>
    void queryClient.invalidateQueries({
      queryKey: queryKeys.articles.all,
      refetchType: "inactive",
    })

  const { state, schedule, flush, exclusive, overwrite, reset, getVersion } =
    useAutosave<ArticleDraft>({
      version: article.version,
      save: async (value, version, options) => {
        const result = await parseResponse(
          articlesApi[":id"].draft.$patch(
            { param: { id }, json: { version, draft: value } },
            options?.keepalive ? { init: { keepalive: true } } : undefined
          )
        )
        syncCache({
          // The column holds any draft; its type is the published shape.
          draft: value as ArticleDetail["draft"],
          version: result.version,
          updatedAt: result.updatedAt,
          status: result.status,
          scheduledFor: result.scheduledFor,
          reviewRequestedAt: result.reviewRequestedAt,
        })
        if (article.status === "scheduled" && result.status === "draft")
          toast.info(UNSCHEDULED_NOTICE, { duration: 10_000 })
        return result
      },
    })

  // A read-only actor can look around; nothing they touch is sent.
  const patch = useCallback(
    (change: Partial<ArticleDraft>) => {
      if (readOnly) return
      const next = { ...draftRef.current, ...change }
      draftRef.current = next
      setDraft(next)
      setErrors((current) => {
        const keys = Object.keys(change)
        const rest = Object.fromEntries(
          Object.entries(current).filter(
            ([key]) => !keys.some((k) => key === k || key.startsWith(`${k}.`))
          )
        )
        return Object.keys(rest).length === Object.keys(current).length
          ? current
          : rest
      })
      schedule(next)
    },
    [readOnly, schedule]
  )

  const replaceWithServer = useCallback(() => {
    reset(getVersion())
    setStale(null)
    void reload()
  }, [getVersion, reload, reset])

  // ⌘S / Ctrl+S saves now.
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
      setErrors(error.fieldErrors ?? {})
      return void toast.error("Fix the highlighted fields before publishing")
    }
    toast.error(error.message)
  }

  const publish = useMutation({
    mutationFn: () =>
      exclusive((version) =>
        parseResponse(
          articlesApi[":id"].publish.$post({
            param: { id },
            json: { version },
          })
        )
      ),
    onSuccess: (result) => {
      syncCache({
        version: result.version,
        status: "published",
        publishedAt: result.publishedAt,
        slug: result.slug,
        scheduledFor: null,
        hasUnpublishedChanges: false,
      })
      setErrors({})
      toast.success("Published")
      refreshLists()
    },
    onError: handleError,
  })

  const submit = useMutation({
    mutationFn: () =>
      flush().then((saved) => {
        if (!saved) throw new Error("Your latest changes are not saved yet")
        return parseResponse(articlesApi[":id"].submit.$post({ param: { id } }))
      }),
    onSuccess: (result) => {
      syncCache({ reviewRequestedAt: result.reviewRequestedAt })
      toast.success("Sent to an editor")
      refreshLists()
    },
    onError: handleError,
  })

  const status = article.status
  const conflictOpen =
    state.status === "conflict" &&
    state.conflict !== null &&
    state.conflict !== dismissed
  const busy = publish.isPending

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <Link
            href="/admin/insights"
            className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            Insights
          </Link>
        }
        icon={<NewspaperIcon />}
        title={draft.title.trim() || "Untitled article"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ArticleStatus
              status={status}
              scheduledFor={article.scheduledFor}
              reviewRequestedAt={article.reviewRequestedAt}
            />
            {status === "published" && article.hasUnpublishedChanges ? (
              <span className="text-xs text-muted-foreground">
                Unpublished changes
              </span>
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
            <TipButton
              label="History"
              icon={HistoryIcon}
              variant="outline"
              size="icon-lg"
              className={HEADER_ICON}
              onClick={() => setHistoryOpen(true)}
            />
            {canPublish && (status === "draft" || status === "archived") ? (
              <TipButton
                label="Schedule"
                icon={CalendarClockIcon}
                variant="outline"
                size="icon-lg"
                className={HEADER_ICON}
                onClick={() => setScheduleOpen(true)}
              />
            ) : null}
            {canPublish &&
            (status === "published" || status === "scheduled") ? (
              <TipButton
                label="Unpublish"
                icon={CalendarXIcon}
                variant="outline"
                size="icon-lg"
                className={HEADER_ICON}
                onClick={() => setUnpublishOpen(true)}
              />
            ) : null}
            {canPublish ? (
              <Button
                className={PRIMARY_ACTION}
                disabled={busy}
                onClick={() => publish.mutate()}
              >
                {busy ? <Spinner data-icon="inline-start" /> : null}
                Publish
              </Button>
            ) : canEdit ? (
              <Button
                className={PRIMARY_ACTION}
                disabled={submit.isPending}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <SendIcon data-icon="inline-start" />
                )}
                Submit for review
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
            <span className="font-semibold">This article changed.</span>{" "}
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
          <span>View only: you can read this article but not change it.</span>
        </p>
      ) : null}
      <Tabs
        value={tab}
        onValueChange={(value) => void setTab(value as "content" | "seo")}
        className="gap-5"
      >
        <TabsList className="h-11 w-fit max-w-full rounded-xl bg-card p-1">
          <TabsTrigger value="content" className="rounded-lg px-5">
            <FileTextIcon aria-hidden />
            Content
          </TabsTrigger>
          <TabsTrigger value="seo" className="rounded-lg px-5">
            <SearchCheckIcon aria-hidden />
            SEO
          </TabsTrigger>
        </TabsList>
        <TabsContent value="content">
          <fieldset
            disabled={readOnly}
            className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
          >
            <div className="rounded-card flex min-w-0 flex-col gap-5 bg-card p-5 sm:p-6">
              <Field>
                <FieldLabel htmlFor="article-title">Title</FieldLabel>
                <Input
                  id="article-title"
                  value={draft.title}
                  maxLength={200}
                  readOnly={readOnly}
                  aria-invalid={errors.title ? true : undefined}
                  onChange={(event) => patch({ title: event.target.value })}
                />
                {errors.title?.[0] ? (
                  <p className="text-sm text-destructive">{errors.title[0]}</p>
                ) : null}
              </Field>
              <ArticleBodyEditor
                value={draft.body}
                onChange={(body) => patch({ body })}
                readOnly={readOnly}
              />
              {Object.keys(errors).some((key) => key.startsWith("body")) ? (
                <p role="alert" className="text-sm text-destructive">
                  Add some text to the article body before publishing.
                </p>
              ) : null}
            </div>
            <aside
              aria-label="Article settings"
              className="rounded-card bg-card p-5 sm:p-6 xl:sticky xl:top-4"
            >
              <ArticleSidebar
                draft={draft}
                patch={patch}
                errors={errors}
                article={article}
                canPublish={canPublish}
              />
            </aside>
          </fieldset>
        </TabsContent>
        <TabsContent value="seo">
          <ArticleSeoForm
            article={article}
            draft={draft}
            onSaved={refreshLists}
          />
        </TabsContent>
      </Tabs>
      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        revisions={articleRevisionsQuery(id)}
        restore={async (rev, version) => {
          const result = await parseResponse(
            articlesApi[":id"].revisions[":rev"].restore.$post({
              param: { id, rev },
              json: { version },
            })
          )
          if (article.status === "scheduled" && result.status === "draft")
            toast.info(UNSCHEDULED_NOTICE, { duration: 10_000 })
          return result
        }}
        exclusive={exclusive}
        canRestore={canEdit}
        onRestored={replaceWithServer}
        onConflict={setStale}
      />
      <ScheduleDialog
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
        id={id}
        exclusive={exclusive}
        onConflict={setStale}
        onDone={(result) => {
          syncCache({
            version: result.version,
            status: "scheduled",
            scheduledFor: result.scheduledFor,
          })
          refreshLists()
        }}
      />
      <UnpublishDialog
        open={unpublishOpen}
        onOpenChange={setUnpublishOpen}
        id={id}
        exclusive={exclusive}
        onConflict={setStale}
        onDone={(result) => {
          syncCache({
            version: result.version,
            status: result.status,
            scheduledFor: null,
            hasUnpublishedChanges: false,
          })
          refreshLists()
        }}
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

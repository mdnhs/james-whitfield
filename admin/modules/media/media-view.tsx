"use client"

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  ChevronRightIcon,
  FileJsonIcon,
  FileTextIcon,
  ImageIcon,
  ImageOffIcon,
  LayersIcon,
  RotateCwIcon,
  UploadIcon,
} from "lucide-react"
import Image from "next/image"
import {
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { InfoHint } from "@/admin/components/actions/icon-tip"
import { TipButton } from "@/admin/components/actions/tip-button"
import { IconPill } from "@/admin/components/dashboard/icon-pill"
import { PageHeader } from "@/admin/components/dashboard/page-header"
import { SectionIcon } from "@/admin/components/dashboard/section-icon"
import { usePermission } from "@/admin/lib/actor-context"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { servedAsIs } from "@/lib/media"

import { MediaDetails } from "./media-details"
import { mediaListQuery, type MediaItem } from "./queries"
import { ACCEPT_ALL, uploadFile } from "./upload"
import { MediaGridSkeleton } from "@/admin/components/dashboard/skeletons"

const parsers = {
  q: parseAsString.withDefault(""),
  type: parseAsStringLiteral(["image", "pdf", "lottie"] as const),
  missingAlt: parseAsBoolean.withDefault(false),
  page: parseAsInteger.withDefault(1),
}

type Progress = { id: number; name: string; fraction: number }
type Failure = { id: number; file: File; message: string }
let nextId = 0

export function MediaView() {
  const queryClient = useQueryClient()
  const canUpload = usePermission({ media: ["upload"] })
  const [state, setState] = useQueryStates(parsers, { history: "replace" })
  const list = useQuery({
    ...mediaListQuery({
      q: state.q,
      type: state.type ?? undefined,
      missingAlt: state.missingAlt,
      page: state.page,
    }),
    placeholderData: keepPreviousData,
  })
  const [openId, setOpenId] = useState<string | null>(null)
  const [uploads, setUploads] = useState<Progress[]>([])
  const [failed, setFailed] = useState<Failure[]>([])
  const opened = list.data?.items.find((item) => item.id === openId) ?? null

  async function upload(files: File[]) {
    // One at a time: the server processes images with a small concurrency cap.
    for (const file of files) {
      const id = nextId++
      const patch = (fraction: number) =>
        setUploads((all) =>
          all.some((u) => u.id === id)
            ? all.map((u) => (u.id === id ? { ...u, fraction } : u))
            : [...all, { id, name: file.name, fraction }]
        )
      patch(0)
      try {
        await uploadFile("/api/v1/admin/media", file, patch)
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : "Upload failed"
        toast.error(`${file.name}: ${message}`)
        // A busy server or a dropped connection is worth another go; the
        // rest need a different file.
        if (
          error instanceof ApiError &&
          (error.code === "UNAVAILABLE" || error.code === "NETWORK")
        )
          setFailed((all) => [...all, { id, file, message }])
      } finally {
        setUploads((all) => all.filter((u) => u.id !== id))
      }
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.media.all })
  }

  const filter = (patch: Partial<typeof state>) =>
    setState({ ...patch, page: 1 })
  const items = list.data?.items ?? []
  const total = list.data?.total ?? 0
  const pageSize = list.data?.pageSize ?? 40

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Media"
        icon={<SectionIcon id="media" />}
        description="Images and PDFs used across the site."
      />
      {canUpload ? (
        <label
          className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed p-6 text-center text-sm focus-within:ring-3 focus-within:ring-ring/50 hover:bg-muted/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void upload([...e.dataTransfer.files])
          }}
        >
          <UploadIcon aria-hidden className="size-6 text-muted-foreground" />
          <span className="flex items-center gap-1 font-medium">
            Drop files here or choose them
            <InfoHint id="media-upload-types">
              JPEG, PNG, WebP, AVIF, SVG, ICO, PDF or Lottie JSON, up to 20 MB
              each
            </InfoHint>
          </span>
          <input
            type="file"
            multiple
            aria-label="Upload files"
            accept={ACCEPT_ALL}
            className="sr-only"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ""
              if (files.length) void upload(files)
            }}
          />
        </label>
      ) : null}
      <div role="status" className="flex flex-col gap-1 text-sm">
        {uploads.map((u) => (
          <p key={u.id}>
            Uploading {u.name}: {Math.round(u.fraction * 100)}%
          </p>
        ))}
      </div>
      {failed.length ? (
        <div role="alert" className="flex flex-col gap-2 text-sm">
          {failed.map(({ id, file, message }) => (
            <div key={id} className="flex flex-wrap items-center gap-2">
              <span className="text-destructive">
                {file.name}: {message}
              </span>
              <TipButton
                label="Retry"
                icon={RotateCwIcon}
                onClick={() => {
                  setFailed((all) => all.filter((f) => f.id !== id))
                  void upload([file])
                }}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="Search the library"
          placeholder="Search by file name or alt text"
          className="max-w-xs"
          value={state.q}
          onChange={(e) => filter({ q: e.target.value })}
        />
        <div className="flex gap-1">
          {(
            [
              [null, "All", LayersIcon],
              ["image", "Images", ImageIcon],
              ["pdf", "PDFs", FileTextIcon],
              ["lottie", "Lottie", FileJsonIcon],
            ] as const
          ).map(([value, label, Icon]) => (
            <Button
              key={label}
              type="button"
              size="sm"
              variant={state.type === value ? "secondary" : "outline"}
              aria-pressed={state.type === value}
              onClick={() => filter({ type: value })}
            >
              <Icon data-icon="inline-start" aria-hidden />
              {label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="media-missing-alt"
            checked={state.missingAlt}
            onCheckedChange={(missingAlt) => filter({ missingAlt })}
          />
          <Label htmlFor="media-missing-alt">
            <ImageOffIcon
              aria-hidden
              className="size-4 text-muted-foreground"
            />
            Missing alt text
          </Label>
        </div>
      </div>

      {list.isPending ? (
        <MediaGridSkeleton />
      ) : list.isError ? (
        <EmptyState
          title="The library didn't load"
          description={list.error.message}
          action={<Button onClick={() => list.refetch()}>Try again</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No files found"
          description="Uploads appear here."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <li key={item.id}>
              <MediaCard item={item} onOpen={() => setOpenId(item.id)} />
            </li>
          ))}
        </ul>
      )}
      {total > state.page * pageSize ? (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setState({ page: state.page + 1 })}
          >
            Next page
            <ChevronRightIcon data-icon="inline-end" aria-hidden />
          </Button>
        </div>
      ) : null}
      <MediaDetails item={opened} onClose={() => setOpenId(null)} />
    </div>
  )
}

function MediaCard({ item, onOpen }: { item: MediaItem; onOpen(): void }) {
  const isImage = item.mimeType.startsWith("image/")
  const needsAlt = isImage && !item.alt && !item.isDecorative
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border bg-card p-2 text-left text-sm",
        "hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
    >
      <span className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-muted">
        {isImage ? (
          <Image
            src={item.url}
            unoptimized={servedAsIs(item.url)}
            alt=""
            fill
            sizes="(min-width: 1280px) 20vw, (min-width: 640px) 30vw, 50vw"
            className="object-cover"
            style={{
              objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%`,
            }}
          />
        ) : (
          <FileTextIcon className="size-10 text-muted-foreground" aria-hidden />
        )}
      </span>
      <span className="truncate font-medium">{item.filename}</span>
      {needsAlt ? (
        <IconPill tone="warning" icon={ImageOffIcon} className="self-start">
          Needs alt text
        </IconPill>
      ) : null}
    </button>
  )
}

"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { useActor } from "@/admin/lib/actor-context"
import { mediaApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { hasPermission } from "@/lib/auth/permissions"

import { FocalPicker } from "./focal-picker"
import type { MediaItem } from "./queries"
import { uploadFile } from "./upload"

// docs/brief.md §7.2: authors edit only the files they uploaded. The server
// enforces it; this only hides controls that would be refused.
export function useMediaRights(item: Pick<MediaItem, "createdBy"> | null) {
  const actor = useActor()
  const editAll = hasPermission(
    actor.roles.filter((role) => role !== "author"),
    { media: ["update"] }
  )
  const own = item?.createdBy === actor.user.id
  return {
    canEdit:
      hasPermission(actor.roles, { media: ["update"] }) && (editAll || own),
    canDelete:
      hasPermission(actor.roles, { media: ["delete"] }) && (editAll || own),
  }
}

export function MediaDetails({
  item,
  onClose,
}: {
  item: MediaItem | null
  onClose(): void
}) {
  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold break-all">
            {item?.filename ?? "File"}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Details, usage and actions for this file
          </SheetDescription>
        </SheetHeader>
        {item ? (
          <DetailsBody
            key={`${item.id}:${item.url}`}
            item={item}
            onClose={onClose}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function DetailsBody({ item, onClose }: { item: MediaItem; onClose(): void }) {
  const queryClient = useQueryClient()
  const { canEdit, canDelete } = useMediaRights(item)
  const isImage = item.mimeType.startsWith("image/")
  const [alt, setAlt] = useState(item.alt)
  const [caption, setCaption] = useState(item.caption ?? "")
  const [decorative, setDecorative] = useState(item.isDecorative)
  const [focal, setFocal] = useState({ x: item.focalX, y: item.focalY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const usage = useQuery({
    queryKey: queryKeys.media.usage(item.id),
    queryFn: () =>
      parseResponse(mediaApi[":id"].usage.$get({ param: { id: item.id } })),
  })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.media.all })

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await parseResponse(
        mediaApi[":id"].$patch({
          param: { id: item.id },
          json: {
            alt,
            caption: caption || null,
            isDecorative: decorative,
            focalX: focal.x,
            focalY: focal.y,
          },
        })
      )
      toast.success("Details saved")
      await refresh()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the details")
    } finally {
      setSaving(false)
    }
  }

  async function replace(file: File) {
    setError(null)
    try {
      await uploadFile(`/api/v1/admin/media/${item.id}/replace`, file, () => {})
      toast.success("File replaced")
      await refresh()
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't replace the file")
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${item.filename}? This can't be undone.`))
      return
    setError(null)
    try {
      await parseResponse(mediaApi[":id"].$delete({ param: { id: item.id } }))
      toast.success("File deleted")
      await refresh()
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't delete the file")
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {isImage ? (
        <FocalPicker
          item={item}
          value={focal}
          onChange={setFocal}
          disabled={!canEdit}
        />
      ) : null}
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        className="text-sm font-medium underline underline-offset-4"
      >
        Open file
      </a>

      <fieldset disabled={!canEdit} className="flex min-w-0 flex-col gap-4">
        {isImage ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="media-alt">Alt text</Label>
              <Textarea
                id="media-alt"
                value={alt}
                maxLength={300}
                disabled={decorative || !canEdit}
                onChange={(e) => setAlt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{alt.length}/300</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="media-decorative"
                checked={decorative}
                onCheckedChange={setDecorative}
              />
              <Label htmlFor="media-decorative">
                Decorative (screen readers skip it)
              </Label>
            </div>
          </>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="media-caption">Caption</Label>
          <Input
            id="media-caption"
            value={caption}
            maxLength={500}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>
        {canEdit ? (
          <div>
            <Button type="button" onClick={save} disabled={saving}>
              Save details
            </Button>
          </div>
        ) : null}
      </fieldset>

      <section aria-labelledby="media-usage" className="flex flex-col gap-2">
        <h3 id="media-usage" className="text-sm font-semibold">
          Used on
        </h3>
        {usage.isPending ? (
          <p className="text-sm text-muted-foreground">Checking…</p>
        ) : usage.isError ? (
          <p className="text-sm text-muted-foreground">{usage.error.message}</p>
        ) : usage.data.items.length ? (
          <ul className="list-disc pl-5 text-sm">
            {usage.data.items.map((use) => (
              <li key={`${use.kind}:${use.id}`}>
                {use.label} ({use.kind})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Not used anywhere</p>
        )}
      </section>

      {canEdit ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="media-replace">
            Replace file (keeps every reference)
          </Label>
          <Input
            id="media-replace"
            type="file"
            accept={
              isImage
                ? "image/jpeg,image/png,image/webp,image/avif"
                : "application/pdf"
            }
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void replace(file)
              e.target.value = ""
            }}
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {canDelete ? (
        <div>
          <Button type="button" variant="destructive" onClick={remove}>
            Delete file
          </Button>
        </div>
      ) : null}
    </div>
  )
}

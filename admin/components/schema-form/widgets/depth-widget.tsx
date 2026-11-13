"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { LayersIcon, RefreshCwIcon } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import {
  useController,
  useWatch,
  type Control,
  type FieldValues,
} from "react-hook-form"

import { IconTip } from "@/admin/components/actions/icon-tip"
import { mediaApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { mediaListQuery } from "@/admin/modules/media/queries"
import { uploadFile } from "@/admin/modules/media/upload"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

import type { FormField } from "../to-fields"
import { describedBy, LabelRow } from "./shell"

type Ref = { mediaId: string } | null | undefined

// The hero's depth map: built in the browser from the sibling `image` field
// whenever the editor picks a new photo, or on demand. Without one the hero
// still shows the photo, with a flat gentle drift instead of parallax.
export function DepthWidget({
  field,
  control,
}: {
  field: FormField
  control: Control<FieldValues>
}) {
  const id = useId()
  const queryClient = useQueryClient()
  const { field: input } = useController({ name: field.name, control })
  const imageName = field.name.replace(/depth$/, "image")
  const image = useWatch({ control, name: imageName }) as Ref
  const depth = input.value as Ref
  const imageId = image?.mediaId || null
  const depthId = depth?.mediaId || null

  const photo = useQuery({
    ...mediaListQuery({ ids: imageId ? [imageId] : [] }),
    enabled: Boolean(imageId),
  })
  const map = useQuery({
    ...mediaListQuery({ ids: depthId ? [depthId] : [] }),
    enabled: Boolean(depthId),
  })
  const photoItem = photo.data?.items.find((item) => item.id === imageId)
  const mapItem = map.data?.items.find((item) => item.id === depthId)

  // The last run, for the photo it ran on: another photo shows neither its
  // spinner nor its error. Runs are numbered so a slow one never overwrites
  // a newer photo's map.
  const [job, setJob] = useState<{
    imageId: string
    busy: boolean
    error: string | null
  } | null>(null)
  const ours = job?.imageId === imageId ? job : null
  const busy = Boolean(ours?.busy)
  const error = ours?.error ?? null
  const run = useRef(0)
  const onChange = input.onChange

  async function generate(item: { id: string; url: string; filename: string }) {
    const current = ++run.current
    const settle = (next: { busy: boolean; error: string | null }) => {
      if (current === run.current) setJob({ imageId: item.id, ...next })
    }
    settle({ busy: true, error: null })
    try {
      const { buildDepthMap, sameOriginSrc } = await import("./depth-map")
      const blob = await buildDepthMap(sameOriginSrc(item.url))
      const name = `${item.filename.replace(/\.[^.]+$/, "")}-depth.png`
      const uploaded = await uploadFile(
        "/api/v1/admin/media",
        new File([blob], name, { type: "image/png" }),
        () => {}
      )
      // A depth map is not content: no alt text needed. Best effort.
      await parseResponse(
        mediaApi[":id"].$patch({
          param: { id: uploaded.id },
          json: { isDecorative: true },
        })
      ).catch(() => {})
      await queryClient.invalidateQueries({ queryKey: queryKeys.media.all })
      if (current === run.current) onChange({ mediaId: uploaded.id })
      settle({ busy: false, error: null })
    } catch (cause) {
      const reason =
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : "Unknown error"
      settle({
        busy: false,
        error: `Couldn't build the depth map (${reason}). The hero still shows the photo, without depth.`,
      })
    }
  }

  // A new photo (not the one the form opened with) gets a fresh map; a
  // removed photo drops its map.
  const seen = useRef(imageId)
  const pending = useRef(false)
  useEffect(() => {
    if (seen.current === imageId) return
    seen.current = imageId
    run.current++
    onChange(null)
    pending.current = Boolean(imageId)
  }, [imageId, onChange])
  useEffect(() => {
    if (!pending.current || !photoItem) return
    pending.current = false
    void generate(photoItem)
    // generate is recreated each render; the run counter guards it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoItem])

  const label = mapItem ? "Regenerate depth map" : "Generate depth map"
  return (
    <Field data-invalid={error ? true : undefined}>
      <LabelRow id={id} field={field} />
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {busy ? (
            <Spinner aria-hidden className="size-5 text-muted-foreground" />
          ) : mapItem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mapItem.url}
              alt="Depth map preview"
              className="size-full object-cover"
            />
          ) : (
            <LayersIcon aria-hidden className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <IconTip label={label}>
            <Button
              id={id}
              type="button"
              variant="outline"
              size="icon"
              aria-label={label}
              aria-describedby={describedBy(id, field, error ?? undefined)}
              disabled={busy || !photoItem}
              onClick={() => photoItem && void generate(photoItem)}
            >
              <RefreshCwIcon aria-hidden />
            </Button>
          </IconTip>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {busy
            ? "Building depth map…"
            : !imageId
              ? "Choose a background photo first."
              : mapItem
                ? null
                : "No depth map yet: the photo shows without parallax."}
        </p>
      </div>
      {field.description && field.warning ? (
        <FieldDescription id={`${id}-description`}>
          {field.description}
        </FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  )
}

"use client"

import { useQuery } from "@tanstack/react-query"
import { useRef, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import {
  useController,
  useWatch,
  type Control,
  type FieldValues,
} from "react-hook-form"

import { mediaListQuery } from "@/admin/modules/media/queries"
import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field"
import {
  cropAreaToFrame,
  frameToCropArea,
  STEP_SLOT_ASPECT,
} from "@/lib/content/frame"
import type { StepFrame } from "@/lib/content/types"

import type { FormField } from "../to-fields"

// docs/brief.md §6.3: step frames are crop rectangles edited visually. The
// image is the sibling `image` field of the same row.
export function FrameWidget({
  field,
  control,
}: {
  field: FormField
  control: Control<FieldValues>
}) {
  const { field: input } = useController({ name: field.name, control })
  const imageName = field.name.replace(/frame$/, "image")
  const image = useWatch({ control, name: imageName }) as
    { mediaId?: string } | undefined
  const media = useQuery({
    ...mediaListQuery({ ids: image?.mediaId ? [image.mediaId] : [] }),
    enabled: Boolean(image?.mediaId),
  })
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  // The cropper reports its initial area on mount; only user moves are edits.
  const touched = useRef(false)
  const sliderId = `${field.name}-zoom`
  const src = media.data?.items[0]?.url
  return (
    <FieldSet>
      <FieldLegend variant="label">{field.label}</FieldLegend>
      {src ? (
        <>
          <div
            role="group"
            aria-label={`${field.label}: drag the image to move it, or use the zoom slider`}
            className="relative h-64 overflow-hidden rounded-xl bg-muted"
          >
            <Cropper
              key={src}
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={STEP_SLOT_ASPECT}
              initialCroppedAreaPercentages={
                input.value
                  ? frameToCropArea(input.value as StepFrame)
                  : undefined
              }
              onCropChange={(next) => {
                touched.current = true
                setCrop(next)
              }}
              onZoomChange={(next) => {
                touched.current = true
                setZoom(next)
              }}
              onCropComplete={(area: Area) => {
                if (touched.current) input.onChange(cropAreaToFrame(area))
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor={sliderId} className="text-sm">
              Zoom
            </label>
            <input
              id={sliderId}
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              className="flex-1"
              onChange={(e) => {
                touched.current = true
                setZoom(Number(e.target.value))
              }}
            />
          </div>
        </>
      ) : (
        <FieldDescription>Choose the image first.</FieldDescription>
      )}
      <FieldDescription>
        Drag to move, scroll or pinch to zoom. The box is the shape the site
        shows.
      </FieldDescription>
    </FieldSet>
  )
}

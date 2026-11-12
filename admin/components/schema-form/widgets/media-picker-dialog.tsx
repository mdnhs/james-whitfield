"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { FileTextIcon, UploadIcon } from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"

import { usePermission } from "@/admin/lib/actor-context"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import { mediaListQuery, type MediaItem } from "@/admin/modules/media/queries"
import { uploadFile } from "@/admin/modules/media/upload"
import { buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/avif"

export function Thumb({ item }: { item: MediaItem }) {
  return item.mimeType.startsWith("image/") ? (
    <Image
      src={item.url}
      alt={item.alt}
      width={item.width ?? 160}
      height={item.height ?? 120}
      sizes="160px"
      className="aspect-[4/3] w-full rounded-lg object-cover"
      style={{ objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%` }}
    />
  ) : (
    <FileTextIcon aria-hidden className="m-auto size-8" />
  )
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onPick,
  selectedId,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onPick(item: MediaItem): void
  selectedId?: string | null
}) {
  const [q, setQ] = useState("")
  const queryClient = useQueryClient()
  const canUpload = usePermission({ media: ["upload"] })
  // Fraction uploaded, or null when idle.
  const [progress, setProgress] = useState<number | null>(null)
  const library = useQuery({
    ...mediaListQuery({ q, type: "image" }),
    enabled: open,
  })

  // Upload straight from the picker, then pick the new image for the field.
  async function upload(file: File) {
    setProgress(0)
    try {
      const item = await uploadFile("/api/v1/admin/media", file, setProgress)
      await queryClient.invalidateQueries({ queryKey: queryKeys.media.all })
      onPick(item)
      onOpenChange(false)
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Upload failed"
      toast.error(`${file.name}: ${message}`)
    } finally {
      setProgress(null)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            aria-label="Search the library"
            placeholder="Search by name or alt text"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          {canUpload ? (
            <label
              className={cn(
                buttonVariants({ variant: "outline" }),
                "shrink-0 cursor-pointer focus-within:ring-3 focus-within:ring-ring/50",
                progress !== null && "pointer-events-none opacity-60"
              )}
            >
              <UploadIcon aria-hidden />
              {progress === null
                ? "Upload new"
                : `Uploading ${Math.round(progress * 100)}%`}
              <input
                type="file"
                aria-label="Upload a new image"
                accept={ACCEPT_IMAGES}
                className="sr-only"
                disabled={progress !== null}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  if (file) void upload(file)
                }}
              />
            </label>
          ) : null}
        </div>
        <ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
          {(library.data?.items ?? []).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="w-full rounded-xl border p-1 text-left focus-visible:ring-2 focus-visible:ring-ring"
                aria-pressed={item.id === selectedId}
                onClick={() => {
                  onPick(item)
                  onOpenChange(false)
                }}
              >
                <Thumb item={item} />
                <span className="mt-1 block truncate text-xs">
                  {item.alt || item.filename}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
